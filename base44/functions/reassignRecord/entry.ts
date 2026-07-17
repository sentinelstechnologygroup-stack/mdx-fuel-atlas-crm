import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Reassign ownership of a single CRM record.
// Enforces role-based authority, validates the destination assignment, uses
// operation-ID idempotency to prevent duplicate history, applies transfer-
// integrity compensation (history failure restores ownership), and writes an
// audit log entry. Never overwrites the original creator.

const ENTITY_MAP = {
  lead: 'Lead',
  opportunity: 'Opportunity',
  task: 'Task',
  activity: 'Activity',
  client: 'Client'
};
const DISPLAY_FIELD = {
  lead: 'full_name',
  opportunity: 'lead_name',
  task: 'title',
  activity: 'summary',
  client: 'full_name'
};

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}
function isActive(u) { return !u || !u.account_status || u.account_status === 'active'; }
function makeIdempotencyKey(operationId, entityType, entityId, destOwnerId) {
  return `${operationId || ''}:${entityType}:${entityId}:${destOwnerId || ''}`;
}

// Validate the destination user / team / supervisor and derive consistent
// values. Returns { error, status } on failure or { destUser, teamId,
// supervisorId } on success.
async function validateDestination(base44, { toOwnerUserId, toTeamId, toSupervisorId }) {
  const destUser = await base44.asServiceRole.entities.User.get(toOwnerUserId).catch(() => null);
  if (!destUser) return { error: 'Destination user not found.', status: 404 };
  if (!isActive(destUser)) return { error: 'Destination user is not active.', status: 400 };

  let teamId = toTeamId || destUser.team_id || null;
  if (toTeamId) {
    const team = await base44.asServiceRole.entities.Team.get(toTeamId).catch(() => null);
    if (!team) return { error: 'Destination team not found.', status: 404 };
    if (destUser.team_id && toTeamId !== destUser.team_id) {
      return { error: 'Destination user does not belong to the supplied team.', status: 400 };
    }
  }

  let supervisorId = toSupervisorId || null;
  if (toSupervisorId) {
    const sup = await base44.asServiceRole.entities.User.get(toSupervisorId).catch(() => null);
    if (!sup) return { error: 'Destination supervisor not found.', status: 404 };
    if (!isActive(sup)) return { error: 'Destination supervisor is not active.', status: 400 };
    const supRole = effectiveRole(sup);
    if (!['supervisor', 'administrator', 'super_admin'].includes(supRole)) {
      return { error: 'Destination supervisor must be a Supervisor, Administrator, or Super Administrator.', status: 400 };
    }
    if (sup.team_id && teamId && sup.team_id !== teamId) {
      return { error: 'Destination supervisor does not manage the destination team.', status: 400 };
    }
    supervisorId = toSupervisorId;
  } else if (destUser.supervisor_user_id) {
    // Derive from destination user only when consistent with the team.
    const sup = await base44.asServiceRole.entities.User.get(destUser.supervisor_user_id).catch(() => null);
    if (sup && (!sup.team_id || !teamId || sup.team_id === teamId)) {
      supervisorId = destUser.supervisor_user_id;
    } else {
      supervisorId = null; // do not preserve an inconsistent supervisor
    }
  }
  return { destUser, teamId, supervisorId };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const entityType = (body.entity_type || '').toLowerCase();
    const entityId = body.entity_id;
    const toOwnerUserId = body.to_owner_user_id;
    const toTeamId = body.to_team_id || null;
    const toSupervisorId = body.to_supervisor_user_id || null;
    const transferReason = body.transfer_reason || '';
    const transferType = body.transfer_type || 'manual';
    const operationId = body.transfer_operation_id || ('reassign-' + Date.now());

    const entityName = ENTITY_MAP[entityType];
    if (!entityName || !entityId || !toOwnerUserId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const actorRole = effectiveRole(user);
    const isAdminTier = actorRole === 'super_admin' || actorRole === 'administrator' || user.role === 'admin';
    const isSupervisor = actorRole === 'supervisor';

    if (!isAdminTier && !isSupervisor) {
      return Response.json({ error: 'You do not have permission to reassign records.' }, { status: 403 });
    }

    // Load the target record (service role to guarantee access).
    const record = await base44.asServiceRole.entities[entityName].get(entityId);
    if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });

    // Supervisor scope: source record must be within their own team.
    if (isSupervisor) {
      const myTeamId = user.team_id || null;
      if (!myTeamId) {
        return Response.json({ error: 'Supervisor has no assigned team.' }, { status: 403 });
      }
      if (!record.assigned_team_id || record.assigned_team_id !== myTeamId) {
        return Response.json({ error: 'Supervisors may only reassign records within their own team.' }, { status: 403 });
      }
      // to_team_id must be the supervisor's team (cannot omit to bypass, cannot
      // supply another team).
      const effectiveTeamId = toTeamId || myTeamId;
      if (effectiveTeamId !== myTeamId) {
        return Response.json({ error: 'Supervisors may not transfer records to another team.' }, { status: 403 });
      }
      // Destination supervisor, if supplied, must belong to the same team.
      if (toSupervisorId) {
        const sup = await base44.asServiceRole.entities.User.get(toSupervisorId).catch(() => null);
        if (!sup) return Response.json({ error: 'Destination supervisor not found.' }, { status: 404 });
        if (!isActive(sup)) return Response.json({ error: 'Destination supervisor is not active.' }, { status: 400 });
        if (sup.team_id && sup.team_id !== myTeamId) {
          return Response.json({ error: 'Supervisor cannot select an employee from another team.' }, { status: 403 });
        }
      }
    }

    // Validate destination assignment.
    const dest = await validateDestination(base44, { toOwnerUserId, toTeamId, toSupervisorId });
    if (dest.error) return Response.json({ error: dest.error }, { status: dest.status || 400 });
    const { destUser, teamId, supervisorId } = dest;

    // Supervisor: resulting team must remain the supervisor's team, and the
    // destination user must belong to that team (or be the supervisor).
    if (isSupervisor) {
      const myTeamId = user.team_id;
      if (teamId !== myTeamId) {
        return Response.json({ error: 'Resulting assigned team must remain the supervisor team.' }, { status: 403 });
      }
      const destInTeam = destUser.id === user.id || (destUser.team_id && destUser.team_id === myTeamId) ||
        (destUser.supervisor_user_id && destUser.supervisor_user_id === user.id);
      if (!destInTeam) {
        return Response.json({ error: 'Destination user is not a member of the supervisor team.' }, { status: 403 });
      }
    }

    // Idempotency: skip if a completed history entry already exists.
    const idemKey = makeIdempotencyKey(operationId, entityType, entityId, destUser.id);
    const existing = await base44.asServiceRole.entities.RecordTransferHistory.filter(
      { idempotency_key: idemKey, transfer_status: 'completed' }, '-created_date', 1
    ).catch(() => []);
    if (existing && existing.length > 0) {
      return Response.json({ success: true, status: 'already_processed', idempotency_key: idemKey });
    }

    const now = new Date().toISOString();
    const displayName = record[DISPLAY_FIELD[entityType]] || record.full_name || record.title || record.id;
    const fromOwner = record.owner_user_id || null;
    const fromTeam = record.assigned_team_id || null;
    const fromSupervisor = record.assigned_supervisor_user_id || null;

    const update = {
      owner_user_id: destUser.id,
      assigned_team_id: teamId,
      assigned_supervisor_user_id: supervisorId,
      ownership_status: 'assigned',
      assignment_date: now,
      assigned_by_user_id: user.id,
      last_modified_by_user_id: user.id
    };
    if (destUser.email && (entityName === 'Lead' || entityName === 'Task')) update.assigned_to = destUser.email;
    if (destUser.email && entityName === 'Client') update.assigned_csm = destUser.email;

    // Capture previous state for compensation/restore.
    const previousState = {
      owner_user_id: fromOwner,
      assigned_team_id: fromTeam,
      assigned_supervisor_user_id: fromSupervisor,
      ownership_status: record.ownership_status || 'unassigned',
      assignment_date: record.assignment_date || null,
      assigned_by_user_id: record.assigned_by_user_id || null,
      last_modified_by_user_id: record.last_modified_by_user_id || null
    };
    if (entityName === 'Lead' || entityName === 'Task') previousState.assigned_to = record.assigned_to || null;
    if (entityName === 'Client') previousState.assigned_csm = record.assigned_csm || null;

    // Attempt the record update.
    await base44.asServiceRole.entities[entityName].update(entityId, update);

    // Attempt the transfer-history append.
    const historyBase = {
      entity_type: entityType,
      entity_id: entityId,
      entity_display_name: displayName,
      from_owner_user_id: fromOwner,
      to_owner_user_id: destUser.id,
      from_team_id: fromTeam,
      to_team_id: teamId,
      from_supervisor_user_id: fromSupervisor,
      to_supervisor_user_id: supervisorId,
      transferred_by_user_id: user.id,
      transfer_reason: transferReason,
      transfer_type: transferType,
      transfer_date: now,
      notes: body.notes || '',
      transfer_operation_id: operationId,
      idempotency_key: idemKey
    };

    let historyOk = false;
    let historyError = null;
    try {
      await base44.asServiceRole.entities.RecordTransferHistory.create({ ...historyBase, transfer_status: 'completed', error_message: null });
      historyOk = true;
    } catch (e) { historyError = e.message; }

    if (historyOk) {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'record_reassign',
          entity: entityName,
          entity_id: entityId,
          user_email: user.email,
          details: JSON.stringify({ from_owner_user_id: fromOwner, to_owner_user_id: destUser.id, transfer_type: transferType, reason: transferReason, idempotency_key: idemKey }),
          timestamp: now
        });
      } catch (_e) { /* best-effort */ }
      return Response.json({ success: true, status: 'completed', idempotency_key: idemKey });
    }

    // History failed — attempt to restore previous ownership.
    let restored = false;
    try {
      await base44.asServiceRole.entities[entityName].update(entityId, previousState);
      restored = true;
    } catch (_e) { /* restore failed */ }

    try {
      await base44.asServiceRole.entities.RecordTransferHistory.create({
        ...historyBase, transfer_status: restored ? 'failed' : 'reconciliation_required', error_message: historyError
      });
    } catch (_e) { /* best-effort */ }

    if (restored) {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'record_reassign_failed_restored',
          entity: entityName, entity_id: entityId, user_email: user.email,
          details: JSON.stringify({ error: historyError, idempotency_key: idemKey }), timestamp: now
        });
      } catch (_e) {}
      return Response.json({ success: false, status: 'failed', error: 'Transfer history could not be recorded; ownership was restored. ' + historyError, idempotency_key: idemKey }, { status: 500 });
    }

    try { await base44.asServiceRole.entities[entityName].update(entityId, { ownership_status: 'transfer_pending' }); } catch (_e) {}
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'record_reassign_reconciliation_required',
        entity: entityName, entity_id: entityId, user_email: user.email,
        details: JSON.stringify({ error: historyError, idempotency_key: idemKey }), timestamp: now
      });
    } catch (_e) {}
    return Response.json({ success: false, status: 'reconciliation_required', error: 'Transfer history failed and ownership could not be restored. Manual reconciliation required.', entity_type: entityType, entity_id: entityId, idempotency_key: idemKey }, { status: 500 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});