import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Deactivate a user account and optionally transfer their records.
// Never deletes the user or any records. Blocks deactivation of the final
// active Super Administrator. Preserves all created-by / modified-by history.
//
// Phase 3B.1: applies operation-ID idempotency, destination validation,
// and transfer-integrity compensation. Partial transfer failures are
// disclosed honestly and never reported as complete success.

const ENTITY_OWNER_CONFIG = [
  { type: 'lead', entity: 'Lead', ownerField: 'owner_user_id', displayField: 'full_name', legacyEmailField: 'assigned_to' },
  { type: 'opportunity', entity: 'Opportunity', ownerField: 'owner_user_id', displayField: 'lead_name', legacyEmailField: null },
  { type: 'task', entity: 'Task', ownerField: 'owner_user_id', displayField: 'title', legacyEmailField: 'assigned_to' },
  { type: 'activity', entity: 'Activity', ownerField: 'owner_user_id', displayField: 'summary', legacyEmailField: null },
  { type: 'client', entity: 'Client', ownerField: 'owner_user_id', displayField: 'full_name', legacyEmailField: 'assigned_csm' }
];

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}
function isActive(u) { return !u || !u.account_status || u.account_status === 'active'; }
function makeIdempotencyKey(operationId, entityType, entityId, destOwnerId) {
  return `${operationId || ''}:${entityType}:${entityId}:${destOwnerId || ''}`;
}

async function validateDestination(base44, { toOwnerUserId, toTeamId, toSupervisorId, excludeUserId }) {
  const destUser = await base44.asServiceRole.entities.User.get(toOwnerUserId).catch(() => null);
  if (!destUser) return { error: 'Destination user not found.' };
  if (!isActive(destUser)) return { error: 'Destination user is not active.' };
  if (excludeUserId && destUser.id === excludeUserId) return { error: 'Destination user cannot be the user being deactivated.' };

  let teamId = toTeamId || destUser.team_id || null;
  if (toTeamId) {
    const team = await base44.asServiceRole.entities.Team.get(toTeamId).catch(() => null);
    if (!team) return { error: 'Destination team not found.' };
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

    const actorRole = effectiveRole(user);
    const isAdminTier = actorRole === 'super_admin' || actorRole === 'administrator' || user.role === 'admin';
    if (!isAdminTier) {
      return Response.json({ error: 'Forbidden: only administrators may deactivate users.' }, { status: 403 });
    }

    const body = await req.json();
    const targetId = body.target_user_id;
    const reason = (body.reason || '').trim();
    const transferOption = body.transfer_option || 'mark_inactive'; // mark_inactive | transfer_selected | transfer_all
    const destinationUserId = body.destination_user_id || null;
    const selectedIds = Array.isArray(body.record_ids) ? body.record_ids : null;
    const operationId = body.transfer_operation_id || ('deactivate-' + Date.now());

    if (!targetId) return Response.json({ error: 'Missing target_user_id' }, { status: 400 });
    if (!reason) return Response.json({ error: 'A deactivation reason is required.' }, { status: 400 });
    if (targetId === user.id) return Response.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });

    const target = await base44.asServiceRole.entities.User.get(targetId);
    if (!target) return Response.json({ error: 'Target user not found' }, { status: 404 });

    // Final Super Administrator protection — evaluate the effective role.
    if (effectiveRole(target) === 'super_admin') {
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const activeSuperAdmins = allUsers.filter((u) => isActive(u) && effectiveRole(u) === 'super_admin');
      if (activeSuperAdmins.length <= 1 && activeSuperAdmins[0]?.id === target.id) {
        return Response.json({
          error: 'This is the last active Super Administrator and cannot be deactivated, suspended, or demoted.'
        }, { status: 400 });
      }
    }

    // Administrators cannot deactivate super_admin/administrator users.
    if (actorRole === 'administrator' && (effectiveRole(target) === 'super_admin' || effectiveRole(target) === 'administrator')) {
      return Response.json({ error: 'Administrators may not deactivate Super Administrators or other Administrators.' }, { status: 403 });
    }

    // Gather records owned by the target across all entity types.
    const ownedByEntity = {};
    let totalOwned = 0;
    for (const cfg of ENTITY_OWNER_CONFIG) {
      const items = await base44.asServiceRole.entities[cfg.entity].filter({ [cfg.ownerField]: targetId }, '-created_date', 500);
      ownedByEntity[cfg.type] = items;
      totalOwned += items.length;
    }

    const now = () => new Date().toISOString();

    // If transferring, validate the destination user.
    let destUser = null;
    let destTeamId = null;
    let destSupervisorId = null;
    if (transferOption !== 'mark_inactive') {
      if (!destinationUserId) return Response.json({ error: 'A destination active user is required for transfers.' }, { status: 400 });
      const dest = await validateDestination(base44, { toOwnerUserId: destinationUserId, toTeamId: null, toSupervisorId: null, excludeUserId: targetId });
      if (dest.error) return Response.json({ error: dest.error }, { status: 400 });
      destUser = dest.destUser;
      destTeamId = dest.teamId;
      destSupervisorId = dest.supervisorId;
    }

    // Preview mode: return counts only, perform no changes.
    if (body.preview) {
      return Response.json({
        preview: true,
        total_owned_records: totalOwned,
        counts: Object.fromEntries(Object.entries(ownedByEntity).map(([k, v]) => [k, v.length]))
      });
    }

    let transferSuccess = 0;
    let transferFailure = 0;
    let alreadyProcessed = 0;
    let reconciliationRequired = 0;
    const failedTransfers = [];
    const reconciliationTransfers = [];

    for (const cfg of ENTITY_OWNER_CONFIG) {
      let recordsToTransfer = [];
      if (transferOption === 'transfer_all') recordsToTransfer = ownedByEntity[cfg.type];
      else if (transferOption === 'transfer_selected') {
        recordsToTransfer = ownedByEntity[cfg.type].filter((r) => selectedIds && selectedIds.includes(r.id));
      }

      for (const record of recordsToTransfer) {
        try {
          const idemKey = makeIdempotencyKey(operationId, cfg.type, record.id, destUser.id);
          // Idempotency: skip if already completed.
          const existing = await base44.asServiceRole.entities.RecordTransferHistory.filter(
            { idempotency_key: idemKey, transfer_status: 'completed' }, '-created_date', 1
          ).catch(() => []);
          if (existing && existing.length > 0) { alreadyProcessed++; continue; }

          const fromOwner = record[cfg.ownerField] || null;
          const fromTeam = record.assigned_team_id || null;
          const fromSupervisor = record.assigned_supervisor_user_id || null;
          const display = record[cfg.displayField] || record.full_name || record.title || record.id;
          const ts = now();

          const update = {
            owner_user_id: destUser.id,
            assigned_team_id: destTeamId,
            assigned_supervisor_user_id: destSupervisorId,
            ownership_status: 'assigned',
            assignment_date: ts,
            assigned_by_user_id: user.id,
            last_modified_by_user_id: user.id
          };
          if (destUser.email && cfg.legacyEmailField) update[cfg.legacyEmailField] = destUser.email;

          const previousState = {
            [cfg.ownerField]: fromOwner,
            assigned_team_id: fromTeam,
            assigned_supervisor_user_id: fromSupervisor,
            ownership_status: record.ownership_status || 'unassigned',
            assignment_date: record.assignment_date || null,
            assigned_by_user_id: record.assigned_by_user_id || null,
            last_modified_by_user_id: record.last_modified_by_user_id || null
          };
          if (cfg.legacyEmailField) previousState[cfg.legacyEmailField] = record[cfg.legacyEmailField] || null;

          await base44.asServiceRole.entities[cfg.entity].update(record.id, update);

          const historyBase = {
            entity_type: cfg.type,
            entity_id: record.id,
            entity_display_name: display,
            from_owner_user_id: fromOwner,
            to_owner_user_id: destUser.id,
            from_team_id: fromTeam,
            to_team_id: destTeamId,
            from_supervisor_user_id: fromSupervisor,
            to_supervisor_user_id: destSupervisorId,
            transferred_by_user_id: user.id,
            transfer_reason: reason,
            transfer_type: 'deactivation',
            transfer_date: ts,
            related_deactivated_user_id: target.id,
            notes: 'Transferred due to account deactivation',
            transfer_operation_id: operationId,
            idempotency_key: idemKey
          };

          let historyOk = false;
          let historyError = null;
          try {
            await base44.asServiceRole.entities.RecordTransferHistory.create({ ...historyBase, transfer_status: 'completed', error_message: null });
            historyOk = true;
          } catch (e) { historyError = e.message; }

          if (historyOk) { transferSuccess++; continue; }

          // History failed — attempt restore.
          let restored = false;
          try {
            await base44.asServiceRole.entities[cfg.entity].update(record.id, previousState);
            restored = true;
          } catch (_e) { /* restore failed */ }

          try {
            await base44.asServiceRole.entities.RecordTransferHistory.create({
              ...historyBase, transfer_status: restored ? 'failed' : 'reconciliation_required', error_message: historyError
            });
          } catch (_e) { /* best-effort */ }

          if (restored) {
            transferFailure++;
            failedTransfers.push({ entity_type: cfg.type, id: record.id, error: 'history failed; ownership restored' });
          } else {
            try { await base44.asServiceRole.entities[cfg.entity].update(record.id, { ownership_status: 'transfer_pending' }); } catch (_e) {}
            reconciliationRequired++;
            reconciliationTransfers.push({ entity_type: cfg.type, id: record.id, error: historyError });
          }
        } catch (e) {
          transferFailure++;
          failedTransfers.push({ entity_type: cfg.type, id: record.id, error: e.message });
        }
      }

      // Mark remaining (not transferred) records as inactive_owner.
      const transferredIds = new Set(recordsToTransfer.map((r) => r.id));
      for (const record of ownedByEntity[cfg.type]) {
        if (transferredIds.has(record.id)) continue;
        try {
          await base44.asServiceRole.entities[cfg.entity].update(record.id, {
            ownership_status: 'inactive_owner',
            last_modified_by_user_id: user.id
          });
        } catch (_e) { /* best-effort */ }
      }
    }

    // Deactivate the user (preserve history — do NOT delete).
    await base44.asServiceRole.entities.User.update(target.id, {
      account_status: 'inactive',
      deactivated_date: now(),
      deactivated_by_user_id: user.id,
      deactivation_reason: reason
    });

    const hasUnresolved = transferFailure > 0 || reconciliationRequired > 0;
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'user_deactivation',
        entity: 'User',
        entity_id: target.id,
        user_email: user.email,
        details: JSON.stringify({
          target_email: target.email,
          reason,
          transfer_option: transferOption,
          operation_id: operationId,
          total_owned_records: totalOwned,
          transfers_succeeded: transferSuccess,
          transfers_failed: transferFailure,
          already_processed: alreadyProcessed,
          reconciliation_required: reconciliationRequired
        }),
        timestamp: now()
      });
    } catch (_e) { /* best-effort */ }

    return Response.json({
      success: !hasUnresolved,
      status: hasUnresolved ? (reconciliationRequired > 0 ? 'reconciliation_required' : 'partial') : 'completed',
      deactivated_user_id: target.id,
      operation_id: operationId,
      total_owned_records: totalOwned,
      counts: Object.fromEntries(Object.entries(ownedByEntity).map(([k, v]) => [k, v.length])),
      transfers_succeeded: transferSuccess,
      transfers_failed: transferFailure,
      already_processed: alreadyProcessed,
      reconciliation_required: reconciliationRequired,
      failed_transfers: failedTransfers,
      reconciliation_transfers: reconciliationTransfers
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});