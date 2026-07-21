import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

// ---------------------------------------------------------------------------
// createCustomRole (Phase 3C.1, Part 10)
// Creates a custom RoleDefinition and clones the base system role's active
// ModulePermissions into the new role_key. Server-enforced authority.
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
const SYSTEM_ROLE_KEYS = ['super_admin', 'administrator', 'supervisor', 'salesperson', 'viewer_support'];
const SYSTEM_ROLE_LEVELS = { super_admin: 5, administrator: 4, supervisor: 3, salesperson: 2, viewer_support: 1 };

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}

function slugify(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40);
}

async function writeAudit(atlasRuntime, actor, details) {
  try {
    await atlasRuntime.asServiceRole.entities.AuditLog.create({
      action: 'custom_role_create',
      entity: 'RoleDefinition',
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
      return Response.json({ error: 'Only administrators may create custom roles.' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_e) { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }
    const { name, description, base_role_key } = body;
    if (!name || !String(name).trim()) return Response.json({ error: 'A role name is required.' }, { status: 400 });
    if (!base_role_key || !SYSTEM_ROLE_KEYS.includes(base_role_key)) {
      return Response.json({ error: 'A valid base system role is required.' }, { status: 400 });
    }

    // Administrators may not create custom roles inheriting from Administrator or Super Administrator.
    if (actorRole !== 'super_admin' && (base_role_key === 'super_admin' || base_role_key === 'administrator')) {
      await writeAudit(atlasRuntime, user, { event: 'denied_admin_custom_role', name, base_role_key });
      return Response.json({ error: 'Only a Super Administrator may create a custom role inheriting from Administrator.' }, { status: 403 });
    }

    const role_key = slugify(name) || ('custom_' + Date.now());

    // Uniqueness: cannot reuse system keys or existing custom keys.
    if (SYSTEM_ROLE_KEYS.includes(role_key)) {
      return Response.json({ error: 'This role key is reserved by a system role. Choose a different name.' }, { status: 400 });
    }
    const existing = await atlasRuntime.asServiceRole.entities.RoleDefinition.list(200);
    if ((existing || []).some((r) => r.role_key === role_key)) {
      return Response.json({ error: 'A role with this key already exists. Choose a different name.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const roleDef = await atlasRuntime.asServiceRole.entities.RoleDefinition.create({
      role_key,
      name: String(name).trim(),
      description: String(description || '').trim(),
      role_type: 'custom',
      base_role_key,
      hierarchy_level: SYSTEM_ROLE_LEVELS[base_role_key] || 1,
      is_system_role: false,
      is_protected: false,
      status: 'active',
      created_by_user_id: user.id,
      last_modified_by_user_id: user.id,
      created_date: now,
      modified_date: now
    });

    // Clone base role's active ModulePermissions into the new role_key.
    const basePerms = await atlasRuntime.asServiceRole.entities.ModulePermission.filter({ role_key: base_role_key, status: 'active' }, 200);
    const toCreate = (basePerms || []).map((bp) => ({
      role_definition_id: roleDef.id,
      role_key,
      module_key: bp.module_key,
      record_scope: bp.record_scope,
      can_view: bp.can_view, can_create: bp.can_create, can_edit: bp.can_edit, can_delete: bp.can_delete,
      can_assign: bp.can_assign, can_export: bp.can_export, can_approve: bp.can_approve,
      can_manage_configuration: bp.can_manage_configuration,
      conditions: {},
      status: 'active',
      created_by_user_id: user.id,
      last_modified_by_user_id: user.id,
      created_date: now,
      modified_date: now
    }));
    if (toCreate.length > 0) {
      await atlasRuntime.asServiceRole.entities.ModulePermission.bulkCreate(toCreate);
    }

    await writeAudit(atlasRuntime, user, { role_key, name, base_role_key, permissions_cloned: toCreate.length, entity_id: roleDef.id });

    return Response.json({ status: 'created', role: roleDef, permissions_cloned: toCreate.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});