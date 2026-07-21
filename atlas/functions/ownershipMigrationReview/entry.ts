import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

// Ownership Migration Review (admin only).
// Two actions:
//   action: 'list'    -> returns records with legacy assigned_to/assigned_csm
//                        email but no owner_user_id, plus a safe proposed match
//                        (unique email match only). Ambiguous/no matches are
//                        flagged and never auto-applied.
//   action: 'confirm' -> applies a single proposed match: sets owner_user_id,
//                        ownership_status, assignment metadata, appends a
//                        correction transfer-history entry, and writes audit.
//
// Phase 3B.1: the request body is parsed EXACTLY ONCE near the beginning and
// reused for all fields. Idempotency prevents duplicate confirmation, and
// transfer-integrity compensation is applied (history failure restores the
// record and returns the transfer as failed / reconciliation_required).

const ENTITY_CONFIG = [
  { type: 'lead', entity: 'Lead', ownerField: 'owner_user_id', emailField: 'assigned_to', displayField: 'full_name' },
  { type: 'opportunity', entity: 'Opportunity', ownerField: 'owner_user_id', emailField: null, displayField: 'lead_name' },
  { type: 'task', entity: 'Task', ownerField: 'owner_user_id', emailField: 'assigned_to', displayField: 'title' },
  { type: 'activity', entity: 'Activity', ownerField: 'owner_user_id', emailField: null, displayField: 'summary' },
  { type: 'client', entity: 'Client', ownerField: 'owner_user_id', emailField: 'assigned_csm', displayField: 'full_name' }
];

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}

function makeIdempotencyKey(operationId, entityType, entityId, destOwnerId) {
  return `${operationId || ''}:${entityType}:${entityId}:${destOwnerId || ''}`;
}

Deno.serve(async (req) => {
  try {
    const atlasRuntime = createClientFromRequest(req);
    const user = await atlasRuntime.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = effectiveRole(user);
    const isAdminTier = role === 'super_admin' || role === 'administrator' || user.role === 'admin';
    if (!isAdminTier) {
      return Response.json({ error: 'Forbidden: ownership migration is administrator-only.' }, { status: 403 });
    }

    // Parse the request body exactly once and reuse it for every field.
    const url = new URL(req.url);
    let body = {};
    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
    }
    const action = body.action || url.searchParams.get('action') || 'list';

    // Build an email -> users index (case-insensitive). Multiple users with the
    // same email produce an ambiguous match.
    const allUsers = await atlasRuntime.asServiceRole.entities.User.list('-created_date', 500);
    const emailIndex = new Map();
    for (const u of allUsers) {
      if (!u.email) continue;
      const key = u.email.toLowerCase();
      if (!emailIndex.has(key)) emailIndex.set(key, []);
      emailIndex.get(key).push(u);
    }

    if (action === 'confirm') {
      const entityType = (body.entity_type || '').toLowerCase();
      const entityId = body.entity_id;
      const matchedUserId = body.matched_user_id;
      const legacyEmail = body.legacy_email || '';
      const forceAdminConfirm = !!body.force_admin_confirm;
      const reason = body.reason || 'Ownership migration review confirmation';
      const operationId = body.transfer_operation_id || ('migration-' + Date.now());

      const cfg = ENTITY_CONFIG.find((c) => c.type === entityType);
      if (!cfg || !entityId || !matchedUserId) {
        return Response.json({ error: 'Missing entity_type, entity_id, or matched_user_id' }, { status: 400 });
      }

      // Verify the match is still safe & the destination user is active.
      const matches = emailIndex.get(String(legacyEmail).toLowerCase()) || [];
      const safeMatch = matches.length === 1 && matches[0].id === matchedUserId;
      const destUser = matches.find((m) => m.id === matchedUserId) || allUsers.find((u) => u.id === matchedUserId);
      if (!destUser) return Response.json({ error: 'Matched user not found' }, { status: 404 });
      if (destUser.account_status && destUser.account_status !== 'active') {
        return Response.json({ error: 'Matched user is not active.' }, { status: 400 });
      }
      if (!safeMatch && !forceAdminConfirm) {
        return Response.json({ error: 'Ambiguous or unsafe match — administrator must explicitly confirm.' }, { status: 400 });
      }
      // A no-match record cannot be silently assigned.
      if (matches.length === 0 && !forceAdminConfirm) {
        return Response.json({ error: 'No user matches this legacy email — cannot assign.' }, { status: 400 });
      }

      // Idempotency: skip if a completed history entry already exists.
      const idemKey = makeIdempotencyKey(operationId, entityType, entityId, destUser.id);
      const existing = await atlasRuntime.asServiceRole.entities.RecordTransferHistory.filter(
        { idempotency_key: idemKey, transfer_status: 'completed' }, '-created_date', 1
      ).catch(() => []);
      if (existing && existing.length > 0) {
        return Response.json({ success: true, status: 'already_processed', idempotency_key: idemKey });
      }

      const record = await atlasRuntime.asServiceRole.entities[cfg.entity].get(entityId);
      if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });

      const now = new Date().toISOString();
      const fromOwner = record[cfg.ownerField] || null;
      const fromTeam = record.assigned_team_id || null;
      const fromSupervisor = record.assigned_supervisor_user_id || null;
      const displayName = record[cfg.displayField] || record.full_name || record.title || entityId;

      const newTeamId = destUser.team_id || fromTeam || null;
      const newSupervisorId = destUser.supervisor_user_id || fromSupervisor || null;

      const update = {
        [cfg.ownerField]: destUser.id,
        assigned_team_id: newTeamId,
        assigned_supervisor_user_id: newSupervisorId,
        ownership_status: 'assigned',
        assignment_date: now,
        assigned_by_user_id: user.id,
        last_modified_by_user_id: user.id
      };
      if (destUser.email && (cfg.entity === 'Lead' || cfg.entity === 'Task')) update.assigned_to = destUser.email;
      if (destUser.email && cfg.entity === 'Client') update.assigned_csm = destUser.email;

      // Capture previous state for compensation/restore.
      const previousState = {
        [cfg.ownerField]: fromOwner,
        assigned_team_id: fromTeam,
        assigned_supervisor_user_id: fromSupervisor,
        ownership_status: record.ownership_status || 'unassigned',
        assignment_date: record.assignment_date || null,
        assigned_by_user_id: record.assigned_by_user_id || null,
        last_modified_by_user_id: record.last_modified_by_user_id || null
      };
      if (cfg.entity === 'Lead' || cfg.entity === 'Task') previousState.assigned_to = record.assigned_to || null;
      if (cfg.entity === 'Client') previousState.assigned_csm = record.assigned_csm || null;

      // Attempt the record update.
      await atlasRuntime.asServiceRole.entities[cfg.entity].update(entityId, update);

      // Attempt the transfer-history append.
      const historyBase = {
        entity_type: entityType,
        entity_id: entityId,
        entity_display_name: displayName,
        from_owner_user_id: fromOwner,
        to_owner_user_id: destUser.id,
        from_team_id: fromTeam,
        to_team_id: newTeamId,
        from_supervisor_user_id: fromSupervisor,
        to_supervisor_user_id: newSupervisorId,
        transferred_by_user_id: user.id,
        transfer_reason: reason,
        transfer_type: 'correction',
        transfer_date: now,
        notes: 'Migrated from legacy email assignment',
        transfer_operation_id: operationId,
        idempotency_key: idemKey
      };

      let historyOk = false;
      let historyError = null;
      try {
        await atlasRuntime.asServiceRole.entities.RecordTransferHistory.create({ ...historyBase, transfer_status: 'completed', error_message: null });
        historyOk = true;
      } catch (e) { historyError = e.message; }

      if (historyOk) {
        try {
          await atlasRuntime.asServiceRole.entities.AuditLog.create({
            action: 'ownership_migration_confirm',
            entity: cfg.entity,
            entity_id: entityId,
            user_email: user.email,
            details: JSON.stringify({ matched_user_id: destUser.id, legacy_email: legacyEmail, idempotency_key: idemKey }),
            timestamp: now
          });
        } catch (_e) { /* best-effort */ }
        return Response.json({ success: true, status: 'completed', idempotency_key: idemKey });
      }

      // History failed — attempt to restore the previous ownership state.
      let restored = false;
      try {
        await atlasRuntime.asServiceRole.entities[cfg.entity].update(entityId, previousState);
        restored = true;
      } catch (_e) { /* restore failed */ }

      // Best-effort: record a failed / reconciliation history entry.
      try {
        await atlasRuntime.asServiceRole.entities.RecordTransferHistory.create({
          ...historyBase,
          transfer_status: restored ? 'failed' : 'reconciliation_required',
          error_message: historyError
        });
      } catch (_e) { /* best-effort */ }

      if (restored) {
        try {
          await atlasRuntime.asServiceRole.entities.AuditLog.create({
            action: 'ownership_migration_failed_restored',
            entity: cfg.entity,
            entity_id: entityId,
            user_email: user.email,
            details: JSON.stringify({ error: historyError, idempotency_key: idemKey }),
            timestamp: now
          });
        } catch (_e) {}
        return Response.json({ success: false, status: 'failed', error: 'Transfer history could not be recorded; ownership was restored. ' + historyError, idempotency_key: idemKey }, { status: 500 });
      }

      // Restore also failed — mark transfer_pending.
      try {
        await atlasRuntime.asServiceRole.entities[cfg.entity].update(entityId, { ownership_status: 'transfer_pending' });
      } catch (_e) { /* best-effort */ }
      try {
        await atlasRuntime.asServiceRole.entities.AuditLog.create({
          action: 'ownership_migration_reconciliation_required',
          entity: cfg.entity,
          entity_id: entityId,
          user_email: user.email,
          details: JSON.stringify({ error: historyError, idempotency_key: idemKey }),
          timestamp: now
        });
      } catch (_e) {}
      return Response.json({
        success: false,
        status: 'reconciliation_required',
        error: 'Transfer history failed and ownership could not be restored. Manual reconciliation required.',
        entity_type: entityType,
        entity_id: entityId,
        idempotency_key: idemKey
      }, { status: 500 });
    }

    // action === 'list'
    const proposals = [];
    for (const cfg of ENTITY_CONFIG) {
      let records = [];
      try {
        records = await atlasRuntime.asServiceRole.entities[cfg.entity].filter({}, '-created_date', 200);
      } catch (_e) { continue; }
      for (const record of records) {
        const legacyEmail = cfg.emailField ? record[cfg.emailField] : null;
        if (!legacyEmail) continue;
        if (record[cfg.ownerField]) continue; // already has portable owner
        const matches = emailIndex.get(String(legacyEmail).toLowerCase()) || [];
        let status = 'no_match';
        let proposedUserId = null;
        if (matches.length === 1) { status = 'unique_match'; proposedUserId = matches[0].id; }
        else if (matches.length > 1) { status = 'ambiguous'; }
        proposals.push({
          entity_type: cfg.type,
          entity_id: record.id,
          entity_name: record[cfg.displayField] || record.full_name || record.title || record.id,
          legacy_assigned_email: legacyEmail,
          proposed_user_id: proposedUserId,
          proposed_user_name: matches.length === 1 ? (matches[0].full_name || matches[0].email) : null,
          match_status: status,
          conflict: matches.length > 1 ? `${matches.length} users share this email` : null
        });
      }
    }

    return Response.json({ proposals, total: proposals.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});