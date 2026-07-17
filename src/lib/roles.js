// Portable MDX role / account-status definitions.
// Intentionally free of Base44 dependencies so this file can be reused
// after the later independent migration.

export const APPLICATION_ROLES = [
  {
    value: 'super_admin',
    label: 'Super Administrator',
    level: 5,
    description:
      'Controls system ownership, administrators, security settings, integration credentials, permanent deletion authorization, emergency access, full audit access, and database-level exports.'
  },
  {
    value: 'administrator',
    label: 'Administrator',
    level: 4,
    description:
      'Controls users below Administrator, configuration, products, fields, workflows, reports, imports, exports, duplicate management, and standard audit access.'
  },
  {
    value: 'supervisor',
    label: 'Supervisor / Sales Manager',
    level: 3,
    description:
      'Manages assigned teams, territories, assignments, pipelines, tasks, approvals, forecasts, and team performance.'
  },
  {
    value: 'salesperson',
    label: 'Salesperson',
    level: 2,
    description:
      'Manages assigned leads, contacts, companies, opportunities, tasks, activities, quotes, templates, goals, and personal pipeline.'
  },
  {
    value: 'viewer_support',
    label: 'Viewer / Support User',
    level: 1,
    description:
      'Receives limited access based on configured module permissions.'
  }
];

export const ROLE_LABELS = Object.fromEntries(
  APPLICATION_ROLES.map((r) => [r.value, r.label])
);

export const ROLE_DESCRIPTIONS = Object.fromEntries(
  APPLICATION_ROLES.map((r) => [r.value, r.description])
);

export const ROLE_VALUES = APPLICATION_ROLES.map((r) => r.value);

// Roles an Administrator is allowed to assign (never super_admin).
export const ASSIGNABLE_ROLES_BY_ADMIN = ['administrator', 'supervisor', 'salesperson', 'viewer_support'];

// Roles a Super Administrator may assign.
export const ASSIGNABLE_ROLES_BY_SUPER_ADMIN = ROLE_VALUES;

export const ACCOUNT_STATUSES = [
  { value: 'invited', label: 'Invited' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' }
];

export const STATUS_LABELS = Object.fromEntries(
  ACCOUNT_STATUSES.map((s) => [s.value, s.label])
);

export const TEAM_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

export const TERRITORY_TYPES = [
  { value: 'geographic', label: 'Geographic' },
  { value: 'service_area', label: 'Service Area' },
  { value: 'named_accounts', label: 'Named Accounts' },
  { value: 'industry', label: 'Industry' },
  { value: 'custom', label: 'Custom' }
];

export const TERRITORY_TYPE_LABELS = Object.fromEntries(
  TERRITORY_TYPES.map((t) => [t.value, t.label])
);

export function roleLabel(value) {
  return ROLE_LABELS[value] || 'Viewer / Support User';
}

export function roleDescription(value) {
  return ROLE_DESCRIPTIONS[value] || ROLE_DESCRIPTIONS.viewer_support;
}

export function roleLevel(value) {
  const role = APPLICATION_ROLES.find((r) => r.value === value);
  return role ? role.level : 1;
}

export function statusLabel(value) {
  return STATUS_LABELS[value] || 'Active';
}

export function territoryTypeLabel(value) {
  return TERRITORY_TYPE_LABELS[value] || 'Geographic';
}

export function displayName(user) {
  if (!user) return 'Unnamed User';
  return (
    user.display_name ||
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.email ||
    'Unnamed User'
  );
}

export function getInitials(user) {
  const name = displayName(user);
  if (!name || name === 'Unnamed User') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Role-safety helpers (Phase 3B)
//
// Centralized, portable validation so the same rules run on the client and
// can later move into the independent backend without rewriting call sites.
// ---------------------------------------------------------------------------

// Compute the effective MDX application role for a user, including the
// temporary Base44 bootstrap fallback (Base44 admin with no explicit role
// is treated as super_admin). This MUST stay in sync with the backend
// function logic.
export function effectiveRole(user) {
  if (!user) return 'viewer_support';
  const raw = user.application_role;
  if (raw) return raw;
  const isBootstrapAdmin = user.role === 'admin';
  return isBootstrapAdmin ? 'super_admin' : 'viewer_support';
}

export function isEffectiveSuperAdmin(user) {
  return effectiveRole(user) === 'super_admin';
}

export function isEffectiveAdminTier(user) {
  const r = effectiveRole(user);
  return r === 'super_admin' || r === 'administrator';
}

export function isEffectiveSupervisor(user) {
  return effectiveRole(user) === 'supervisor';
}

export function isEffectiveSalesperson(user) {
  return effectiveRole(user) === 'salesperson';
}

export function isEffectiveViewerSupport(user) {
  return effectiveRole(user) === 'viewer_support';
}

// A user is considered active if their account_status is active, or the
// field is unset (treated as active by default). Bootstrap admins are active.
export function isUserActive(user) {
  if (!user) return false;
  if (!user.account_status) return true;
  return user.account_status === 'active';
}

// Count active Super Administrators across a user list, evaluating the
// effective role (so a bootstrap Base44 admin with no persisted role still
// counts as the final super admin and cannot be locked out).
export function activeSuperAdminCount(allUsers) {
  if (!Array.isArray(allUsers)) return 0;
  return allUsers.filter((u) => isUserActive(u) && isEffectiveSuperAdmin(u)).length;
}

// Returns true if `user` is the last active Super Administrator in `allUsers`.
export function isLastActiveSuperAdmin(user, allUsers) {
  if (!user || !isEffectiveSuperAdmin(user) || !isUserActive(user)) return false;
  return activeSuperAdminCount(allUsers) <= 1;
}

// Roles a given actor is allowed to assign.
export function assignableRolesFor(actor) {
  if (isEffectiveSuperAdmin(actor)) return ROLE_VALUES;
  if (isEffectiveAdminTier(actor)) return ASSIGNABLE_ROLES_BY_ADMIN;
  return [];
}

// Whether an actor can change another user's role to `targetRole`.
export function canAssignRole(actor, targetUser, targetRole) {
  if (!isEffectiveAdminTier(actor)) return false;
  // Administrators cannot manage super_admin or administrator-tier users.
  if (isEffectiveSuperAdmin(actor)) {
    // Super admin can assign any role, but cannot demote the last super admin.
    if (isLastActiveSuperAdmin(targetUser, [actor, targetUser]) && targetRole !== 'super_admin') return false;
    return true;
  }
  // Administrator: cannot touch super_admin or administrator users, cannot grant admin-tier.
  if (isEffectiveSuperAdmin(targetUser) || effectiveRole(targetUser) === 'administrator') return false;
  if (targetRole === 'super_admin' || targetRole === 'administrator') return false;
  return ASSIGNABLE_ROLES_BY_ADMIN.includes(targetRole);
}

// Whether an actor can deactivate a target user.
export function canDeactivateUser(actor, targetUser, allUsers) {
  if (!isEffectiveAdminTier(actor)) return false;
  if (actor && targetUser && actor.id === targetUser.id) return false; // no self-deactivation
  if (isLastActiveSuperAdmin(targetUser, allUsers)) return false;
  // Administrators cannot deactivate super_admin or administrator users.
  if (isEffectiveSuperAdmin(actor)) return true;
  if (isEffectiveSuperAdmin(targetUser) || effectiveRole(targetUser) === 'administrator') return false;
  return true;
}

// Ownership / reassignment authority.
export function canReassignRecord(actor, record, allUsers) {
  if (!actor) return false;
  const r = effectiveRole(actor);
  if (r === 'super_admin' || r === 'administrator') return true;
  if (r === 'supervisor') {
    // Only within their managed team.
    return record && record.assigned_team_id && record.assigned_team_id === actor.team_id;
  }
  // Salespeople and viewers cannot reassign ownership to another user.
  return false;
}