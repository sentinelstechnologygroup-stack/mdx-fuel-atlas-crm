// tests/normalizeFirebaseProfile.test.js
import { describe, expect, it } from 'vitest';

import { normalizeFirebaseProfile } from '@/auth/normalizeFirebaseProfile';

describe('normalizeFirebaseProfile', () => {
  it('maps legacy Firebase profile fields to canonical ATLAS fields', () => {
    const profile = normalizeFirebaseProfile('admin-user', {
      uid: 'admin-user',
      displayName: 'Test Administrator',
      role: 'admin',
      status: 'active',
      teamId: 'team-alpha',
      supervisorId: 'supervisor-user',
    });

    expect(profile).toMatchObject({
      id: 'admin-user',
      uid: 'admin-user',
      display_name: 'Test Administrator',
      application_role: 'administrator',
      account_status: 'active',
      team_id: 'team-alpha',
      supervisor_user_id: 'supervisor-user',
      territory_ids: [],
    });
  });

  it('preserves canonical ATLAS fields when both formats are present', () => {
    const profile = normalizeFirebaseProfile('canonical-user', {
      role: 'salesperson',
      status: 'inactive',
      teamId: 'legacy-team',
      supervisorId: 'legacy-supervisor',
      application_role: 'supervisor',
      account_status: 'active',
      team_id: 'canonical-team',
      supervisor_user_id: 'canonical-supervisor',
      territory_ids: ['territory-north'],
    });

    expect(profile.application_role).toBe('supervisor');
    expect(profile.account_status).toBe('active');
    expect(profile.team_id).toBe('canonical-team');
    expect(profile.supervisor_user_id).toBe('canonical-supervisor');
    expect(profile.territory_ids).toEqual(['territory-north']);
  });

  it.each([
    ['super_admin', 'super_admin'],
    ['admin', 'administrator'],
    ['supervisor', 'supervisor'],
    ['salesperson', 'salesperson'],
    ['viewer_support', 'viewer_support'],
  ])('maps legacy role %s to %s', (legacyRole, expectedRole) => {
    const profile = normalizeFirebaseProfile('role-user', {
      role: legacyRole,
      status: 'active',
    });

    expect(profile.application_role).toBe(expectedRole);
  });

  it('uses safe null and empty-array defaults for missing authorization fields', () => {
    const profile = normalizeFirebaseProfile('minimal-user');

    expect(profile).toMatchObject({
      id: 'minimal-user',
      uid: 'minimal-user',
      display_name: null,
      application_role: null,
      account_status: null,
      team_id: null,
      supervisor_user_id: null,
      territory_ids: [],
    });
  });
});
