import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ---------------------------------------------------------------------------
// updateModulePermission (Phase 3C.1)
// Create or update one role/module permission. Server-enforced authority.
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

async function writeAudit(base44, actor, details) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'module_permission_update',
      entity: 'ModulePermission',
      entity_id: details.entity_id || null,
      user_email: actor?.email || 'system',
      details: JSON.stringify(details),
      timestamp: new Date().toISOString()
    });
  } catch (_e) { /* non-blocking */ }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const actorRole = effectiveRole(user);
    if (actorRole !== 'super_admin' && actorRole !== 'administrator' && user.role !== 'admin') {
      return Response.json({ error: 'Only administrators may modify module permissions.' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_e) { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }

    const { role_key, module_key, reason, ...fields } = body;
    if (!role_key || !module_key) return Response.json({ error: 'role_key and module_key are required.' }, { status: 400 });
    if (!ACTIVE_MODULE_KEYS.includes(module_key)) return Response.json({ error: 'Unknown or inactive module key.' }, { status: 400 });

    // Load the RoleDefinition to check protection + custom base.
    const roleDefs = await base44.asServiceRole.entities.RoleDefinition.list(200);
    const roleDef = (roleDefs || []).find((r) => r.role_key === role_key);
    if (!roleDef) return Response.json({ error: 'Role definition not found.' }, { status: 404 });

    // Authority checks.
    if (actorRole !== 'super_admin') {
      // Administrators cannot edit super_admin or administrator permissions.
      if (roleDef.role_key === 'super_admin' || roleDef.role_key === 'administrator') {
        await writeAudit(base44, user, { event: 'denied_protected_role_edit', role_key, module_key, reason });
        return Response.json({ error: 'Only a Super Administrator may modify Administrator-tier role permissions.' }, { status: 403 });
      }
      // Administrators cannot manage custom roles that inherit from Administrator.
      if (roleDef.role_type === 'custom' && (roleDef.base_role_key === 'super_admin' || roleDef.base_role_key === 'administrator')) {
        await writeAudit(base44, user, { event: 'denied_admin_custom_role_edit', role_key, module_key, reason });
        return Response.json({ error: 'Only a Super Administrator may manage custom roles inheriting from Administrator.' }, { status: 403 });
      }
      // Administrators cannot grant configuration authority over admin-tier modules to lower roles.
      if (ADMIN_TIER_MODULES.includes(module_key) && fields.can_manage_configuration === true) {
        await writeAudit(base44, user, { event: 'denied_admin_config_grant', role_key, module_key, reason });
        return Response.json({ error: 'Only a Super Administrator may grant configuration authority over Roles/Permissions or Security Settings.' }, { status: 403 });
      }
    }

    // Super Administrator permissions are protected and cannot be disabled.
    let effectiveFields = { ...fields };
    if (roleDef.role_key === 'super_admin') {
      for (const f of ACTION_FLAGS) effectiveFields[f] = true;
      effectiveFields.record_scope = 'all';
    }

    // Sanitize action flags to booleans.
    const clean = { record_scope: effectiveFields.record_scope || 'none' };
    for (const f of ACTION_FLAGS) clean[f] = !!effectiveFields[f];

    const now = new Date().toISOString();

    // Upsert: find active record for role_key + module_key.
    const existing = await base44.asServiceRole.entities.ModulePermission.filter({ role_key, module_key, status: 'active' }, 5);
    let record;
    let previous = null;
    if (existing && existing.length > 0) {
      record = existing[0];
      previous = { record_scope: record.record_scope };
      for (const f of ACTION_FLAGS) previous[f] = record[f];
      record = await base44.asServiceRole.entities.ModulePermission.update(record.id, {
        ...clean,
        last_modified_by_user_id: user.id,
        modified_date: now
      });
    } else {
      record = await base44.asServiceRole.entities.ModulePermission.create({
        role_definition_id: roleDef.id,
        role_key,
        module_key,
        ...clean,
        conditions: {},
        status: 'active',
        created_by_user_id: user.id,
        last_modified_by_user_id: user.id,
        created_date: now,
        modified_date: now
      });
    }

    await writeAudit(base44, user, {
      role_key, module_key, reason: reason || null,
      previous, new: clean,
      entity_id: record.id
    });

    return Response.json({ status: 'saved', record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});