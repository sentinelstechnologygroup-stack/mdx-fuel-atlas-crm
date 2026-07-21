import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

// ---------------------------------------------------------------------------
// initializePermissionModel (Phase 3C.1)
// Idempotently seeds system RoleDefinitions + default ModulePermissions.
// Never duplicates roles or permissions; never overwrites customized records.
// ---------------------------------------------------------------------------

const SYSTEM_ROLE_DEFS = [
  { role_key: 'super_admin', name: 'Super Administrator', description: 'Controls system ownership, administrators, security, and full audit access.', hierarchy_level: 5, is_protected: true },
  { role_key: 'administrator', name: 'Administrator', description: 'Controls users below Administrator, configuration, reports, imports, exports, and audit access.', hierarchy_level: 4, is_protected: true },
  { role_key: 'supervisor', name: 'Supervisor / Sales Manager', description: 'Manages assigned teams, assignments, pipelines, and team performance.', hierarchy_level: 3, is_protected: false },
  { role_key: 'salesperson', name: 'Salesperson', description: 'Manages assigned leads, opportunities, tasks, and personal pipeline.', hierarchy_level: 2, is_protected: false },
  { role_key: 'viewer_support', name: 'Viewer / Support User', description: 'Receives limited access based on configured module permissions.', hierarchy_level: 1, is_protected: false }
];

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

function p(scope, v, c, e, d, a, x, ap, cfg) {
  return {
    record_scope: scope,
    can_view: v, can_create: c, can_edit: e, can_delete: d,
    can_assign: a, can_export: x, can_approve: ap, can_manage_configuration: cfg
  };
}
const NONE = p('none', false, false, false, false, false, false, false, false);
function allTrue() { return p('all', true, true, true, true, true, true, true, true); }

function baseMap(overrides) {
  const out = {};
  for (const k of ACTIVE_MODULE_KEYS) out[k] = { ...NONE };
  return { ...out, ...overrides };
}

const ADMIN = baseMap({
  dashboard: p('all', true, false, false, false, false, false, false, false),
  leads: p('all', true, true, true, false, true, true, false, false),
  opportunities: p('all', true, true, true, false, true, true, true, false),
  tasks: p('all', true, true, true, false, true, false, false, false),
  activities: p('all', true, true, true, false, false, false, false, false),
  clients: p('all', true, true, true, false, false, false, false, false),
  reports: p('all', true, false, false, false, false, true, false, false),
  automations: p('all', true, true, true, false, false, false, false, true),
  sales_galaxy: p('all', true, false, false, false, false, false, false, false),
  atlas: p('all', true, false, false, false, false, false, false, false),
  marketing_sequences: p('all', true, true, true, false, false, false, false, false),
  marketing_templates: p('all', true, true, true, false, false, false, false, false),
  customer_success: p('all', true, true, true, false, false, false, false, false),
  imports: p('all', true, true, false, false, false, false, false, false),
  exports: p('all', true, true, false, false, false, false, false, false),
  duplicate_management: p('all', true, true, true, false, false, false, false, false),
  users: p('all', true, true, true, false, false, false, false, true),
  teams: p('all', true, true, true, false, false, false, false, true),
  territories: p('all', true, true, true, false, false, false, false, true),
  roles_permissions: p('all', true, false, true, false, false, false, false, false),
  pipeline_configuration: p('all', true, false, true, false, false, false, false, true),
  custom_fields: p('all', true, false, true, false, false, false, false, true),
  system_tags: p('all', true, false, true, false, false, false, false, true),
  workflow_configuration: p('all', true, false, true, false, false, false, false, true),
  organization_settings: p('all', true, false, true, false, false, false, false, true),
  audit_logs: p('all', true, false, false, false, false, true, false, false),
  integrations: p('all', true, false, false, false, false, false, false, true),
  security_settings: p('none', false, false, false, false, false, false, false, false)
});

const SUPERVISOR = baseMap({
  dashboard: p('team', true, false, false, false, false, false, false, false),
  leads: p('team', true, true, true, false, true, false, false, false),
  opportunities: p('team', true, true, true, false, true, false, true, false),
  tasks: p('team', true, true, true, false, true, false, false, false),
  activities: p('team', true, true, true, false, false, false, false, false),
  clients: p('team', true, false, true, false, false, false, false, false),
  reports: p('team', true, false, false, false, false, false, false, false),
  sales_galaxy: p('team', true, false, false, false, false, false, false, false),
  atlas: p('team', true, false, false, false, false, false, false, false),
  customer_success: p('team', true, false, true, false, false, false, false, false),
  users: p('team', true, false, false, false, false, false, false, false),
  teams: p('team', true, false, false, false, false, false, false, false),
  territories: p('team', true, false, false, false, false, false, false, false)
});

const SALESPERSON = baseMap({
  dashboard: p('own', true, false, false, false, false, false, false, false),
  leads: p('own', true, true, true, false, false, false, false, false),
  opportunities: p('own', true, true, true, false, false, false, false, false),
  tasks: p('own', true, true, true, false, false, false, false, false),
  activities: p('own', true, true, true, false, false, false, false, false),
  clients: p('own', true, false, false, false, false, false, false, false),
  reports: p('own', true, false, false, false, false, false, false, false),
  sales_galaxy: p('own', true, false, false, false, false, false, false, false),
  atlas: p('own', true, false, false, false, false, false, false, false)
});

const VIEWER_SUPPORT = baseMap({});

const DEFAULT_MATRIX = {
  super_admin: baseMap(Object.fromEntries(ACTIVE_MODULE_KEYS.map((k) => [k, allTrue()]))),
  administrator: ADMIN,
  supervisor: SUPERVISOR,
  salesperson: SALESPERSON,
  viewer_support: VIEWER_SUPPORT
};

async function writeAudit(atlasRuntime, actor, details) {
  try {
    await atlasRuntime.asServiceRole.entities.AuditLog.create({
      action: 'permission_model_init',
      entity: 'PermissionModel',
      entity_id: null,
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

    const actorRole = user.application_role || (user.role === 'admin' ? 'super_admin' : 'viewer_support');
    if (actorRole !== 'super_admin' && actorRole !== 'administrator' && user.role !== 'admin') {
      return Response.json({ error: 'Only administrators may initialize the permission model.' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // 1. Seed system RoleDefinitions (skip existing role_key).
    const existingRoles = await atlasRuntime.asServiceRole.entities.RoleDefinition.list(100);
    const existingKeys = new Set((existingRoles || []).map((r) => r.role_key));
    let rolesCreated = 0;
    for (const def of SYSTEM_ROLE_DEFS) {
      if (existingKeys.has(def.role_key)) continue;
      await atlasRuntime.asServiceRole.entities.RoleDefinition.create({
        role_key: def.role_key,
        name: def.name,
        description: def.description,
        role_type: 'system',
        base_role_key: null,
        hierarchy_level: def.hierarchy_level,
        is_system_role: true,
        is_protected: def.is_protected,
        status: 'active',
        created_by_user_id: user.id,
        last_modified_by_user_id: user.id,
        created_date: now,
        modified_date: now
      });
      rolesCreated++;
    }

    // 2. Seed default ModulePermissions (only fill missing active records).
    const allPerms = await atlasRuntime.asServiceRole.entities.ModulePermission.list(500);
    const existsKey = new Set((allPerms || []).filter((m) => m.status === 'active').map((m) => m.role_key + '|' + m.module_key));
    let permsCreated = 0;
    const roleDefMap = {};
    for (const r of (existingRoles || [])) roleDefMap[r.role_key] = r.id;
    // also include newly created ones (lookup again if any created)
    if (rolesCreated > 0) {
      const fresh = await atlasRuntime.asServiceRole.entities.RoleDefinition.list(100);
      for (const r of fresh) roleDefMap[r.role_key] = r.id;
    }

    for (const roleKey of Object.keys(DEFAULT_MATRIX)) {
      const matrix = DEFAULT_MATRIX[roleKey];
      const roleDefId = roleDefMap[roleKey];
      for (const moduleKey of ACTIVE_MODULE_KEYS) {
        const composite = roleKey + '|' + moduleKey;
        if (existsKey.has(composite)) continue;
        const d = matrix[moduleKey] || { ...NONE };
        await atlasRuntime.asServiceRole.entities.ModulePermission.create({
          role_definition_id: roleDefId || null,
          role_key: roleKey,
          module_key: moduleKey,
          record_scope: d.record_scope,
          can_view: d.can_view, can_create: d.can_create, can_edit: d.can_edit, can_delete: d.can_delete,
          can_assign: d.can_assign, can_export: d.can_export, can_approve: d.can_approve,
          can_manage_configuration: d.can_manage_configuration,
          conditions: {},
          status: 'active',
          created_by_user_id: user.id,
          last_modified_by_user_id: user.id,
          created_date: now,
          modified_date: now
        });
        permsCreated++;
      }
    }

    await writeAudit(atlasRuntime, user, {
      roles_created: rolesCreated,
      permissions_created: permsCreated,
      actor_role: actorRole
    });

    return Response.json({
      status: 'initialized',
      roles_created: rolesCreated,
      permissions_created: permsCreated,
      system_roles: Object.keys(DEFAULT_MATRIX),
      active_modules: ACTIVE_MODULE_KEYS.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});