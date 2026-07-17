// ---------------------------------------------------------------------------
// MDX centralized effective-permission resolver (Phase 3C.1) — client preview
//
// Pure, dependency-free resolution used by the admin UI to PREVIEW effective
// results before saving. The BACKEND `getEffectivePermissions` function is the
// authoritative source of truth; this mirrors its logic for responsive UX.
//
// Resolution order:
//   1. Protected Super Administrator  -> all modules, all actions, scope all
//   2. Active, non-expired user override (inherit / replace / restrict)
//   3. Active custom-role permission
//   4. Active base system-role permission
//   5. Safe default denial
// ---------------------------------------------------------------------------

import { SCOPE_RANK, ACTION_FLAGS } from './permissionModules';
import { effectiveRole } from './roles';

export const PERMISSION_SOURCES = [
  'protected_super_admin',
  'user_override',
  'custom_role',
  'base_role',
  'default_denial'
];

function allTrueResult(moduleKey) {
  const r = { module_key: moduleKey, record_scope: 'all', source: 'protected_super_admin' };
  for (const f of ACTION_FLAGS) r[f] = true;
  return r;
}

function allFalseResult(moduleKey, source = 'default_denial') {
  const r = { module_key: moduleKey, record_scope: 'none', source };
  for (const f of ACTION_FLAGS) r[f] = false;
  return r;
}

function isOverrideActive(override, now = Date.now()) {
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

function fromRecord(rec, moduleKey) {
  const r = { module_key: moduleKey, record_scope: rec?.record_scope || 'none' };
  for (const f of ACTION_FLAGS) r[f] = !!(rec && rec[f]);
  return r;
}

function narrowScope(a, b) {
  return (SCOPE_RANK[a] || 0) <= (SCOPE_RANK[b] || 0) ? a : b;
}

// restrict: may only reduce inherited permission. Each action = base AND override.
// Scope = narrower of base/override.
function applyRestrict(base, override, moduleKey) {
  const r = { module_key: moduleKey, record_scope: narrowScope(base.record_scope || 'none', override.record_scope || 'none'), source: 'user_override' };
  for (const f of ACTION_FLAGS) r[f] = !!(base[f] && override[f]);
  return r;
}

// replace: substitute the specified values.
function applyReplace(override, moduleKey) {
  const r = { module_key: moduleKey, record_scope: override.record_scope || 'none', source: 'user_override' };
  for (const f of ACTION_FLAGS) r[f] = !!override[f];
  return r;
}

/**
 * Resolve one module's effective permission.
 *
 * @param {object} opts
 * @param {object} opts.user        target user record
 * @param {string} opts.moduleKey   module key
 * @param {object} [opts.rolePermission]        base system-role ModulePermission record
 * @param {object} [opts.customRolePermission]  active custom-role ModulePermission record
 * @param {object} [opts.override]              active UserPermissionOverride record
 * @returns {object} effective permission with `source`
 */
export function resolvePermission({ user, moduleKey, rolePermission, customRolePermission, override }) {
  const role = effectiveRole(user);

  // 1. Protected Super Administrator
  if (role === 'super_admin') return allTrueResult(moduleKey);

  // Determine base (custom role overrides base role).
  let base;
  let baseSource;
  if (customRolePermission) {
    base = fromRecord(customRolePermission, moduleKey);
    baseSource = 'custom_role';
  } else if (rolePermission) {
    base = fromRecord(rolePermission, moduleKey);
    baseSource = 'base_role';
  } else {
    base = allFalseResult(moduleKey, 'default_denial');
    baseSource = 'default_denial';
  }

  // 2. User override
  if (isOverrideActive(override)) {
    if (override.override_mode === 'inherit') {
      return { ...base, source: baseSource };
    }
    if (override.override_mode === 'replace') {
      return applyReplace(override, moduleKey);
    }
    if (override.override_mode === 'restrict') {
      return applyRestrict(base, override, moduleKey);
    }
  }

  return { ...base, source: baseSource };
}

// Convenience: is a given action allowed?
export function isActionAllowed(effective, action) {
  if (!effective) return false;
  const flag = 'can_' + action;
  return !!effective[flag];
}

export { isOverrideActive };