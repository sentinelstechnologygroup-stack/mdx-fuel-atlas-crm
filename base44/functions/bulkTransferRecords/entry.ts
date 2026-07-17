import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Bulk record transfer (admin tier only).
// Transfers a set of records of a single entity type to one destination user.
// Uses operation-ID idempotency so retrying the same operation never creates
// duplicate history and previously completed records are skipped. Applies
// destination validation and transfer-integrity compensation per record.
//
// Response reports separately:
//   success_count, failure_count, already_processed_count,
//   reconciliation_required_count, failed[], already_processed[],
//   reconciliation_required[].

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

async function validateDestination(base44, { toOwnerUserId, toTeamId, toSupervisorId }) {
  const destUser = await base44.asServiceRole.entities.User.get(toOwnerUserId).catch(() => null);
  if (!destUser) return { error: 'Destination user not found.' };
  if (!isActive(destUser)) return { error: 'Destination user is not active.' };

  let teamId = toTeamId || destUser.team_id || null;
  if (toTeamId) {
    const team = await base44.asServiceRole.entities.Team.get(toTeamId).catch(() => null);
    if (!team) return { error: 'Destination team not found.' };
    if (destUser.team_id && toTeamId !== destUser.team_id) return { error: 'Destination user does not belong to the supplied team.' };
  }

  let supervisorId = toSupervisorId || null;
  if (toSupervisorId) {
    const sup = await base44.asServiceRole.entities.User.get(toSupervisorId).catch(() => null);
    if (!sup) return { error: 'Destination supervisor not found.' };
    if (!isActive(sup)) return { error: 'Destination supervisor is not active.' };
    const supRole = effectiveRole(sup);
    if (!['supervisor', 'administrator', 'super_admin'].includes(supRole)) return { error: 'Destination supervisor must be a Supervisor, Administrator, or Super Administrator.' };
    if (sup.team_id && teamId && sup.team_id !== teamId) return { error: 'Destination supervisor does not manage the destination team.' };
    supervisorId = toSupervisorId;
  } else if (destUser.supervisor_user_id) {
    const sup = await base44.asServiceRole.entities.User.get(destUser.supervisor_user_id).catch(() => null);
    if (sup && (!sup.team_id || !teamId || sup.team_id === teamId)) supervisorId = destUser.supervisor_user_id;
  }
  return { destUser, teamId, supervisorId };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = effectiveRole(user);
    const isAdminTier = role === 'super_admin' || role === 'administrator' || user.role === 'admin';
    if (!isAdminTier) {
      return Response.json({ error: 'Forbidden: bulk transfer is administrator-only.' }, { status: 403 });
    }

    const body = await req.json();
    const entityType = (body.entity_type || '').toLowerCase();
    const ids = Array.isArray(body.record_ids) ? body.record_ids : [];
    const toOwnerUserId = body.to_owner_user_id;
    const toTeamId = body.to_team_id || null;
    const toSupervisorId = body.to_supervisor_user_id || null;
    const transferReason = body.transfer_reason || '';
    const transferType = 'bulk';
    const operationId = body.transfer_operation_id || ('bulk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));

    const entityName = ENTITY_MAP[entityType];
    if (!entityName || ids.length === 0 || !toOwnerUserId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate the destination assignment once for the whole operation.
    const dest = await validateDestination(base44, { toOwnerUserId, toTeamId, toSupervisorId });
    if (dest.error) return Response.json({ error: dest.error }, { status: 400 });
    const { destUser, teamId, supervisorId } = dest;

    const now = () => new Date().toISOString();
    let successCount = 0;
    let failureCount = 0;
    let alreadyProcessedCount = 0;
    let reconciliationRequiredCount = 0;
    const failed = [];
    const alreadyProcessed = [];
    const reconciliationRequired = [];

    for (const id of ids) {
      try {
        const record = await base44.asServiceRole.entities[entityName].get(id);
        if (!record) { failureCount++; failed.push({ id, error: 'not found' }); continue; }

        const idemKey = makeIdempotencyKey(operationId, entityType, id, destUser.id);
        // Idempotency: skip if a completed history entry already exists.
        const existing = await base44.asServiceRole.entities.RecordTransferHistory.filter(
          { idempotency_key: idemKey, transfer_status: 'completed' }, '-created_date', 1
        ).catch(() => []);
        if (existing && existing.length > 0) {
          alreadyProcessedCount++;
          alreadyProcessed.push({ id, idempotency_key: idemKey });
          continue;
        }

        const fromOwner = record.owner_user_id || null;
        const fromTeam = record.assigned_team_id || null;
        const fromSupervisor = record.assigned_supervisor_user_id || null;
        const display = record[DISPLAY_FIELD[entityType]] || record.full_name || record.title || id;
        const ts = now();

        const update = {
          owner_user_id: destUser.id,
          assigned_team_id: teamId,
          assigned_supervisor_user_id: supervisorId,
          ownership_status: 'assigned',
          assignment_date: ts,
          assigned_by_user_id: user.id,
          last_modified_by_user_id: user.id
        };
        if (destUser.email && (entityName === 'Lead' || entityName === 'Task')) update.assigned_to = destUser.email;
        if (destUser.email && entityName === 'Client') update.assigned_csm = destUser.email;

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
        await base44.asServiceRole.entities[entityName].update(id, update);

        // Attempt the history append.
        const historyBase = {
          entity_type: entityType,
          entity_id: id,
          entity_display_name: display,
          from_owner_user_id: fromOwner,
          to_owner_user_id: destUser.id,
          from_team_id: fromTeam,
          to_team_id: teamId,
          from_supervisor_user_id: fromSupervisor,
          to_supervisor_user_id: supervisorId,
          transferred_by_user_id: user.id,
          transfer_reason: transferReason,
          transfer_type: transferType,
          transfer_date: ts,
          notes: 'Bulk transfer',
          transfer_operation_id: operationId,
          idempotency_key: idemKey
        };

        let historyOk = false;
        let historyError = null;
        try {
          await base44.asServiceRole.entities.RecordTransferHistory.create({ ...historyBase, transfer_status: 'completed', error_message: null });
          historyOk = true;
        } catch (e) { historyError = e.message; }

        if (historyOk) { successCount++; continue; }

        // History failed — attempt to restore previous ownership.
        let restored = false;
        try {
          await base44.asServiceRole.entities[entityName].update(id, previousState);
          restored = true;
        } catch (_e) { /* restore failed */ }

        try {
          await base44.asServiceRole.entities.RecordTransferHistory.create({
            ...historyBase, transfer_status: restored ? 'failed' : 'reconciliation_required', error_message: historyError
          });
        } catch (_e) { /* best-effort */ }

        if (restored) {
          failureCount++;
          failed.push({ id, error: 'history failed; ownership restored', idempotency_key: idemKey });
        } else {
          try { await base44.asServiceRole.entities[entityName].update(id, { ownership_status: 'transfer_pending' }); } catch (_e) {}
          reconciliationRequiredCount++;
          reconciliationRequired.push({ id, error: historyError, idempotency_key: idemKey });
        }
      } catch (e) {
        failureCount++;
        failed.push({ id, error: e.message });
      }
    }

    // Single audit entry summarizing the bulk operation.
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'bulk_transfer',
        entity: entityName,
        entity_id: null,
        user_email: user.email,
        details: JSON.stringify({
          entity_type: entityType,
          operation_id: operationId,
          success_count: successCount,
          failure_count: failureCount,
          already_processed_count: alreadyProcessedCount,
          reconciliation_required_count: reconciliationRequiredCount,
          to_owner_user_id: toOwnerUserId,
          reason: transferReason
        }),
        timestamp: now()
      });
    } catch (_e) { /* best-effort */ }

    const hasRemaining = failureCount > 0 || reconciliationRequiredCount > 0;
    return Response.json({
      success: !hasRemaining,
      status: hasRemaining ? (reconciliationRequiredCount > 0 ? 'reconciliation_required' : 'partial') : 'completed',
      operation_id: operationId,
      success_count: successCount,
      failure_count: failureCount,
      already_processed_count: alreadyProcessedCount,
      reconciliation_required_count: reconciliationRequiredCount,
      failed,
      already_processed: alreadyProcessed,
      reconciliation_required: reconciliationRequired
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});