// ---------------------------------------------------------------------------
// MDX default system permission templates (Phase 3C.1)
//
// Portable, dependency-free default module permissions for each system role.
// `initializePermissionModel` seeds exactly one active ModulePermission per
// system role + active module from these defaults. Repeated initialization
// never overwrites administrator-customized permissions — it only fills
// missing records.
// ---------------------------------------------------------------------------

import { ACTIVE_MODULE_KEYS } from './permissionModules';

// Builder: scope + the 8 action flags in canonical order.
function p(scope, v, c, e, d, a, x, ap, cfg) {
  return {
    record_scope: scope,
    can_view: v, can_create: c, can_edit: e, can_delete: d,
    can_assign: a, can_export: x, can_approve: ap, can_manage_configuration: cfg
  };
}

const NONE = p('none', false, false, false, false, false, false, false, false);
function allTrue(scope = 'all') {
  return p(scope, true, true, true, true, true, true, true, true);
}

// Start every role with all-NONE, then layer explicit grants.
function roleBase(overrides) {
  const out = {};
  for (const k of ACTIVE_MODULE_KEYS) out[k] = { ...NONE };
  return { ...out, ...overrides };
}

const ADMIN = roleBase({
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
  // Administrators may configure non-admin-tier role permissions, but not
  // manage the top-level roles_permissions configuration (Super Administrator).
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

const SUPERVISOR = roleBase({
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

const SALESPERSON = roleBase({
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

const VIEWER_SUPPORT = roleBase({});

// Super Administrator is protected (resolved as all-true regardless of
// records), but we still seed all-true records for completeness/audit.
const SUPER_ADMIN = roleBase(
  Object.fromEntries(ACTIVE_MODULE_KEYS.map((k) => [k, allTrue()]))
);

export const DEFAULT_PERMISSIONS = {
  super_admin: SUPER_ADMIN,
  administrator: ADMIN,
  supervisor: SUPERVISOR,
  salesperson: SALESPERSON,
  viewer_support: VIEWER_SUPPORT
};

export const SYSTEM_ROLE_KEYS = ['super_admin', 'administrator', 'supervisor', 'salesperson', 'viewer_support'];

// Hierarchy levels (must match roles.js APPLICATION_ROLES).
export const SYSTEM_ROLE_LEVELS = {
  super_admin: 5,
  administrator: 4,
  supervisor: 3,
  salesperson: 2,
  viewer_support: 1
};

// Clone defaults for a custom role inheriting from a base system role.
export function defaultPermissionsForBaseRole(baseRoleKey) {
  const base = DEFAULT_PERMISSIONS[baseRoleKey] || roleBase({});
  const out = {};
  for (const k of ACTIVE_MODULE_KEYS) out[k] = { ...base[k] };
  return out;
}