// src/auth/constants.js
export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  SALESPERSON: 'salesperson',
  VIEWER_SUPPORT: 'viewer_support',
});

export const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));

export const ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

export const ACCOUNT_STATUS_VALUES = Object.freeze(
  Object.values(ACCOUNT_STATUSES)
);

export function isKnownUserRole(role) {
  return USER_ROLE_VALUES.includes(role);
}

export function isKnownAccountStatus(status) {
  return ACCOUNT_STATUS_VALUES.includes(status);
}
