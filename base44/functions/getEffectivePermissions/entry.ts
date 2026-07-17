import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ---------------------------------------------------------------------------
// getEffectivePermissions (Phase 3C.1)
// Authoritative effective-permission resolution for a user.
//   1. Protected Super Administrator
//   2. Active, non-expired user override
//   3. Active custom-role permission
//   4. Active base system-role permission
//   5. Default denial
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
const SCOPE_RANK = { none: 0, own: 1, team: 2, all: 3 };

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}

function isOverrideActive(override, now) {
  if (!override) return false;
  if (override.status && override.status !== 'active') return false;
  if (override.effective_date) {
    const t = new Date(override.effective_date).getTime();
    if (!Number.isNaN(t) && t > now) return false;
  }
  if (override.expiration_date) {
    const t = new Date(override.expiration_date).getTime();
    if (!Number.isNaN(t) && t < now) return false;
  }
  return true;
}

function fromRecord(rec) {
  const r = { record_scope: rec?.record_scope || 'none' };
  for (const f of ACTION_FLAGS) r[f] = !!(rec && rec[f]);
  return r;
}

function allTrueResult() {
  const r = { record_scope: 'all', source: 'protected_super_admin' };
  for (const f of ACTION_FLAGS) r[f] = true;
  return r;
}

function allFalseResult(source) {
  const r = { record_scope: 'none', source };
  for (const f of ACTION_FLAGS) r[f] = false;
  return r;
}

function narrowScope(a, b) {
  return (SCOPE_RANK[a] || 0) <= (SCOPE_RANK[b] || 0) ? a : b;
}

function resolveOne(role, moduleKey, rolePerm, customPerm, override, now) {
  if (role === 'super_admin') return allTrueResult();

  let base;
  let baseSource;
  if (customPerm) { base = fromRecord(customPerm); baseSource = 'custom_role'; }
  else if (rolePerm) { base = fromRecord(rolePerm); baseSource = 'base_role'; }
  else { base = allFalseResult('default_denial'); baseSource = 'default_denial'; }

  if (isOverrideActive(override, now)) {
    if (override.override_mode === 'inherit') return { ...base, source: baseSource };
    if (override.override_mode === 'replace') {
      const r = { record_scope: override.record_scope || 'none', source: 'user_override' };
      for (const f of ACTION_FLAGS) r[f] = !!override[f];
      return r;
    }
    if (override.override_mode === 'restrict') {
      const r = { record_scope: narrowScope(base.record_scope, override.record_scope || 'none'), source: 'user_override' };
      for (const f of ACTION_FLAGS) r[f] = !!(base[f] && override[f]);
      return r;
    }
  }
  return { ...base, source: baseSource };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_e) { body = {}; }
    const targetUserId = body.target_user_id || null;
    const moduleKey = body.module_key || null;

    let target = user;
    let inspectingOther = false;
    if (targetUserId && targetUserId !== user.id) {
      inspectingOther = true;
      const actorRole = effectiveRole(user);
      // Authority: super_admin may inspect anyone; administrator may inspect users below Administrator.
      if (actorRole !== 'super_admin' && actorRole !== 'administrator' && user.role !== 'admin') {
        return Response.json({ error: 'Supervisors, salespeople, and viewer/support users may not inspect other users\' permissions.' }, { status: 403 });
      }
      target = await base44.asServiceRole.entities.User.get(targetUserId);
      if (!target) return Response.json({ error: 'Target user not found.' }, { status: 404 });
      if (actorRole === 'administrator') {
        const tRole = effectiveRole(target);
        if (tRole === 'super_admin' || tRole === 'administrator') {
          return Response.json({ error: 'Administrators may not inspect Administrator or Super Administrator permissions.' }, { status: 403 });
        }
      }
    }

    const role = effectiveRole(target);
    const now = Date.now();

    // Modules to resolve
    const moduleKeys = moduleKey ? [moduleKey] : ACTIVE_MODULE_KEYS;

    const permissions = {};

    if (role === 'super_admin') {
      for (const mk of moduleKeys) permissions[mk] = allTrueResult();
      return Response.json({
        user: { id: target.id, email: target.email, application_role: role, custom_role_id: target.custom_role_id || null },
        permissions,
        inspecting_other: inspectingOther
      });
    }

    // Determine effective role key for permission lookup (custom role if present & active).
    let permRoleKey = role;
    let customRole = null;
    if (target.custom_role_id) {
      try {
        customRole = await base44.asServiceRole.entities.RoleDefinition.get(target.custom_role_id);
        if (customRole && customRole.status === 'active' && customRole.role_type === 'custom') {
          permRoleKey = customRole.role_key;
        } else {
          customRole = null;
        }
      } catch (_e) { customRole = null; }
    }

    // Load role/module permissions for the effective role key.
    const rolePerms = await base44.asServiceRole.entities.ModulePermission.filter({ role_key: permRoleKey, status: 'active' }, 200);
    const rolePermsByModule = {};
    for (const rp of (rolePerms || [])) rolePermsByModule[rp.module_key] = rp;

    // Load active overrides for the target user.
    const overrides = await base44.asServiceRole.entities.UserPermissionOverride.filter({ user_id: target.id, status: 'active' }, 200);
    const overridesByModule = {};
    for (const ov of (overrides || [])) {
      if (isOverrideActive(ov, now)) overridesByModule[ov.module_key] = ov;
    }

    for (const mk of moduleKeys) {
      const rolePerm = rolePermsByModule[mk] || null;
      const customPerm = customRole ? rolePermsByModule[mk] : null; // custom role perms are stored under the custom role_key
      const override = overridesByModule[mk] || null;
      const resolved = resolveOne(role, mk, rolePerm, customPerm, override, now);
      permissions[mk] = resolved;
    }

    return Response.json({
      user: { id: target.id, email: target.email, application_role: role, custom_role_id: target.custom_role_id || null, custom_role_name: customRole?.name || null },
      permissions,
      inspecting_other: inspectingOther
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});