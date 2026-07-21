import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

// ---------------------------------------------------------------------------
// updateUserPermissionOverride (Phase 3C.1)
// Create / update / deactivate a user permission override. Server-enforced.
// ---------------------------------------------------------------------------

const ACTIVE_MODULE_KEYS = [
  'dashboard', 'leads', 'opportunities', 'tasks', 'activities', 'clients',
  'reports', 'automations', 'sales_galaxy', 'atlas',
  'marketing_sequences', 'marketing_templates',
  'customer_success',
  'imports', 'exports', 'duplicate_management',
  'users', 'teams', 'territories', 'roles_permissions', 'pipeline_configuration',
  'custom_fields', 'system_tags', 'workflow_configuration', 'organization_settings',
  'audit_logs', 'integrations', 'security_settings'
];
const ACTION_FLAGS = [
  'can_view', 'can_create', 'can_edit', 'can_delete', 'can_assign', 'can_export', 'can_approve', 'can_manage_configuration'
];
const ADMIN_TIER_MODULES = ['roles_permissions', 'security_settings'];

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}

async function writeAudit(atlasRuntime, actor, details) {
  try {
    await atlasRuntime.asServiceRole.entities.AuditLog.create({
      action: 'user_override_' + (details.event || 'update'),
      entity: 'UserPermissionOverride',
      entity_id: details.entity_id || null,
      user_email: actor?.email || 'system',
      details: JSON.stringify(details),
      timestamp: new Date().toISOString()
    });
  } catch (_e) { /* non-blocking */ }
}

Deno.serve(async (req) => {
  try {
    const atlasRuntime = createClientFromRequest(req);
    const user = await atlasRuntime.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const actorRole = effectiveRole(user);
    if (actorRole !== 'super_admin' && actorRole !== 'administrator' && user.role !== 'admin') {
      return Response.json({ error: 'Supervisors, salespeople, and viewer/support users may not manage permission overrides.' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_e) { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }

    const { action, user_id, module_key, override_mode, reason, effective_date, expiration_date, ...fields } = body;
    if (!user_id || !module_key) return Response.json({ error: 'user_id and module_key are required.' }, { status: 400 });
    if (!ACTIVE_MODULE_KEYS.includes(module_key)) return Response.json({ error: 'Unknown or inactive module key.' }, { status: 400 });

    // No self-escalation.
    if (user_id === user.id) {
      await writeAudit(atlasRuntime, user, { event: 'denied_self_override', user_id, module_key, reason });
      return Response.json({ error: 'You may not create or modify a permission override for your own account.' }, { status: 403 });
    }

    // Load target.
    const target = await atlasRuntime.asServiceRole.entities.User.get(user_id);
    if (!target) return Response.json({ error: 'Target user not found.' }, { status: 404 });

    if (actorRole !== 'super_admin') {
      const tRole = effectiveRole(target);
      if (tRole === 'super_admin' || tRole === 'administrator') {
        await writeAudit(atlasRuntime, user, { event: 'denied_admin_tier_override', user_id, module_key, reason });
        return Response.json({ error: 'Administrators may not manage overrides for Administrator or Super Administrator accounts.' }, { status: 403 });
      }
      // An override must not grant administrator-equivalent authority.
      if (override_mode === 'replace' && ADMIN_TIER_MODULES.includes(module_key) && fields.can_manage_configuration === true) {
        await writeAudit(atlasRuntime, user, { event: 'denied_override_config_grant', user_id, module_key, reason });
        return Response.json({ error: 'Administrators may not grant configuration authority over Roles/Permissions or Security Settings via override.' }, { status: 403 });
      }
    }

    const now = new Date().toISOString();

    // Find existing active override for this user + module.
    const existing = await atlasRuntime.asServiceRole.entities.UserPermissionOverride.filter({ user_id, module_key, status: 'active' }, 5);
    const existingRecord = existing && existing[0] ? existing[0] : null;

    // Deactivate action.
    if (action === 'deactivate') {
      if (!existingRecord) return Response.json({ error: 'No active override found to deactivate.' }, { status: 404 });
      const updated = await atlasRuntime.asServiceRole.entities.UserPermissionOverride.update(existingRecord.id, {
        status: 'inactive',
        last_modified_by_user_id: user.id,
        modified_date: now
      });
      await writeAudit(atlasRuntime, user, { event: 'deactivate', user_id, module_key, reason: reason || null, entity_id: existingRecord.id });
      return Response.json({ status: 'deactivated', record: updated });
    }

    // Create / update requires a reason and override_mode.
    if (!override_mode) return Response.json({ error: 'override_mode is required (inherit/replace/restrict).' }, { status: 400 });
    if (!['inherit', 'replace', 'restrict'].includes(override_mode)) return Response.json({ error: 'Invalid override_mode.' }, { status: 400 });
    if (!reason || !String(reason).trim()) {
      await writeAudit(atlasRuntime, user, { event: 'denied_missing_reason', user_id, module_key });
      return Response.json({ error: 'A reason is required for every override change.' }, { status: 400 });
    }

    const clean = { record_scope: fields.record_scope || 'none' };
    for (const f of ACTION_FLAGS) clean[f] = !!fields[f];

    let record;
    let previous = null;
    if (existingRecord) {
      previous = { override_mode: existingRecord.override_mode, record_scope: existingRecord.record_scope };
      for (const f of ACTION_FLAGS) previous[f] = existingRecord[f];
      record = await atlasRuntime.asServiceRole.entities.UserPermissionOverride.update(existingRecord.id, {
        override_mode, ...clean, reason: String(reason).trim(),
        effective_date: effective_date || existingRecord.effective_date || now,
        expiration_date: expiration_date || existingRecord.expiration_date || null,
        last_modified_by_user_id: user.id, modified_date: now
      });
    } else {
      record = await atlasRuntime.asServiceRole.entities.UserPermissionOverride.create({
        user_id, module_key, override_mode, ...clean, reason: String(reason).trim(),
        effective_date: effective_date || now, expiration_date: expiration_date || null,
        status: 'active',
        created_by_user_id: user.id, last_modified_by_user_id: user.id,
        created_date: now, modified_date: now
      });
    }

    await writeAudit(atlasRuntime, user, {
      event: 'upsert', user_id, module_key, override_mode, reason: String(reason).trim(),
      previous, new: clean, entity_id: record.id
    });

    return Response.json({ status: 'saved', record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});