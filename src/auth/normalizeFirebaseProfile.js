// src/auth/normalizeFirebaseProfile.js

const LEGACY_ROLE_MAP = Object.freeze({
  super_admin: 'super_admin',
  admin: 'administrator',
  supervisor: 'supervisor',
  salesperson: 'salesperson',
  viewer_support: 'viewer_support',
});

export function normalizeFirebaseProfile(profileId, profileData = {}) {
  const data =
    profileData && typeof profileData === 'object'
      ? profileData
      : {};

  return {
    ...data,
    id: profileId,
    uid: data.uid ?? profileId,
    display_name: data.display_name ?? data.displayName ?? null,
    first_name: data.first_name ?? data.firstName ?? null,
    last_name: data.last_name ?? data.lastName ?? null,
    monthly_gallon_quota:
      data.monthly_gallon_quota ??
      data.monthlyGallonQuota ??
      data.gallon_quota ??
      null,
    application_role:
      data.application_role ??
      LEGACY_ROLE_MAP[data.role] ??
      null,
    account_status:
      data.account_status ??
      data.status ??
      null,
    team_id:
      data.team_id ??
      data.teamId ??
      null,
    supervisor_user_id:
      data.supervisor_user_id ??
      data.supervisorId ??
      null,
    territory_ids: Array.isArray(data.territory_ids)
      ? data.territory_ids
      : Array.isArray(data.territoryIds)
        ? data.territoryIds
        : [],
  };
}
