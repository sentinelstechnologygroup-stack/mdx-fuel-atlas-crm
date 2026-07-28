// tests/entityAdapter.scopes.emulator.test.js
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  signInWithFirebase,
  signOutFromFirebase,
} from '@/auth/firebaseAuthService';
import {
  firebaseAuth,
  firestore,
} from '@/firebase/client';
import { createFirestoreEntity } from '@/firebase/entityAdapter';

const PASSWORD = 'AtlasTest!2026';

const ACCOUNTS = Object.freeze({
  superAdmin: 'superadmin@example.test',
  administrator: 'admin@example.test',
  supervisor: 'supervisor@example.test',
  salesperson: 'salesperson@example.test',
  viewerSupport: 'viewer@example.test',
});

const FIXTURE_IDS = Object.freeze([
  'scope-salesperson-own',
  'scope-team-member',
  'scope-supervisor-own-other-team',
  'scope-supervisor-assigned',
  'scope-other-team',
]);

const leadEntity = createFirestoreEntity('Lead');
const cleanupRecordIds = new Set(FIXTURE_IDS);

function leadDocument(recordId) {
  return doc(
    firestore,
    'entities',
    'Lead',
    'records',
    recordId
  );
}

function leadData({
  name,
  ownerUserId,
  teamId,
  supervisorUserId,
  territoryId,
}) {
  return {
    full_name: name,
    lead_status: 'new',
    owner_user_id: ownerUserId,
    assigned_team_id: teamId,
    assigned_supervisor_user_id: supervisorUserId,
    territory_id: territoryId,
    ownership_status: 'assigned',
    created_by_user_id: 'super-admin-user',
    last_modified_by_user_id: 'super-admin-user',
    created_date: '2026-07-22T00:00:00.000Z',
    updated_date: '2026-07-22T00:00:00.000Z',
  };
}

async function signInAs(email) {
  if (firebaseAuth.currentUser) {
    await signOutFromFirebase();
  }

  return signInWithFirebase(email, PASSWORD);
}

beforeAll(async () => {
  await signInAs(ACCOUNTS.superAdmin);

  await Promise.all([
    setDoc(
      leadDocument('scope-salesperson-own'),
      leadData({
        name: 'Salesperson Own Lead',
        ownerUserId: 'salesperson-user',
        teamId: 'team-alpha',
        supervisorUserId: 'supervisor-user',
        territoryId: 'territory-alpha',
      })
    ),
    setDoc(
      leadDocument('scope-team-member'),
      leadData({
        name: 'Team Member Lead',
        ownerUserId: 'teammate-user',
        teamId: 'team-alpha',
        supervisorUserId: 'supervisor-user',
        territoryId: 'territory-alpha',
      })
    ),
    setDoc(
      leadDocument('scope-supervisor-own-other-team'),
      leadData({
        name: 'Supervisor Owned Lead',
        ownerUserId: 'supervisor-user',
        teamId: 'team-beta',
        supervisorUserId: 'other-supervisor-user',
        territoryId: 'territory-beta',
      })
    ),
    setDoc(
      leadDocument('scope-supervisor-assigned'),
      leadData({
        name: 'Supervisor Assigned Lead',
        ownerUserId: 'other-salesperson-user',
        teamId: 'team-beta',
        supervisorUserId: 'supervisor-user',
        territoryId: 'territory-beta',
      })
    ),
    setDoc(
      leadDocument('scope-other-team'),
      leadData({
        name: 'Other Team Lead',
        ownerUserId: 'other-salesperson-user',
        teamId: 'team-beta',
        supervisorUserId: 'other-supervisor-user',
        territoryId: 'territory-beta',
      })
    ),
  ]);
});

afterAll(async () => {
  await signInAs(ACCOUNTS.superAdmin);

  for (const recordId of cleanupRecordIds) {
    await deleteDoc(leadDocument(recordId)).catch(() => undefined);
  }

  await signOutFromFirebase();
});

describe('Firestore entity adapter record scopes', () => {
  it('lists only salesperson-owned protected records', async () => {
    await signInAs(ACCOUNTS.salesperson);

    const records = await leadEntity.list('full_name', 100);
    const fixtureRecords = records.filter((record) =>
      FIXTURE_IDS.includes(record.id)
    );

    expect(fixtureRecords.map((record) => record.id)).toEqual([
      'scope-salesperson-own',
    ]);

    expect(
      fixtureRecords.every(
        (record) => record.owner_user_id === 'salesperson-user'
      )
    ).toBe(true);
  });

  it('merges and deduplicates supervisor own, team, and assigned records', async () => {
    await signInAs(ACCOUNTS.supervisor);

    const records = await leadEntity.list('full_name', 100);
    const fixtureRecordIds = records
      .filter((record) => FIXTURE_IDS.includes(record.id))
      .map((record) => record.id)
      .sort();

    expect(fixtureRecordIds).toEqual([
      'scope-salesperson-own',
      'scope-supervisor-assigned',
      'scope-supervisor-own-other-team',
      'scope-team-member',
    ]);

    expect(new Set(fixtureRecordIds).size).toBe(
      fixtureRecordIds.length
    );
    expect(fixtureRecordIds).not.toContain('scope-other-team');
  });

  it('allows administrators unrestricted protected-record lists', async () => {
    await signInAs(ACCOUNTS.administrator);

    const records = await leadEntity.list('full_name', 100);
    const recordIds = records.map((record) => record.id);

    expect(recordIds).toEqual(
      expect.arrayContaining(FIXTURE_IDS)
    );
  });

  it('returns no protected records for Viewer Support defaults', async () => {
    await signInAs(ACCOUNTS.viewerSupport);

    const records = await leadEntity.list();

    expect(records).toEqual([]);
  });

  it('overrides forged salesperson assignment fields with canonical profile assignments', async () => {
    await signInAs(ACCOUNTS.salesperson);

    const created = await leadEntity.create({
      full_name: 'Canonical Salesperson Assignment',
      lead_status: 'new',
      owner_user_id: 'forged-owner',
      assigned_team_id: 'forged-team',
      assigned_supervisor_user_id: 'forged-supervisor',
      territory_id: 'forged-territory',
      created_by_user_id: 'forged-creator',
      last_modified_by_user_id: 'forged-modifier',
    });

    cleanupRecordIds.add(created.id);

    expect(created).toMatchObject({
      owner_user_id: 'salesperson-user',
      assigned_team_id: 'team-alpha',
      assigned_supervisor_user_id: 'supervisor-user',
      territory_id: 'territory-alpha',
      ownership_status: 'assigned',
      created_by_user_id: 'salesperson-user',
      last_modified_by_user_id: 'salesperson-user',
    });

    const storedSnapshot = await getDoc(
      leadDocument(created.id)
    );

    expect(storedSnapshot.exists()).toBe(true);
    expect(storedSnapshot.data()).toMatchObject({
      owner_user_id: 'salesperson-user',
      assigned_team_id: 'team-alpha',
      assigned_supervisor_user_id: 'supervisor-user',
      territory_id: 'territory-alpha',
    });
  });

  it('applies the supervisor team and supervisor assignment on creation', async () => {
    await signInAs(ACCOUNTS.supervisor);

    const created = await leadEntity.create({
      full_name: 'Canonical Supervisor Assignment',
      lead_status: 'new',
      owner_user_id: 'teammate-user',
      assigned_team_id: 'forged-team',
      assigned_supervisor_user_id: 'forged-supervisor',
      territory_id: 'forged-territory',
    });

    cleanupRecordIds.add(created.id);

    expect(created).toMatchObject({
      owner_user_id: 'teammate-user',
      assigned_team_id: 'team-alpha',
      assigned_supervisor_user_id: 'supervisor-user',
      territory_id: 'territory-alpha',
      ownership_status: 'assigned',
      created_by_user_id: 'supervisor-user',
      last_modified_by_user_id: 'supervisor-user',
    });

    const stored = await leadEntity.get(created.id);

    expect(stored).toMatchObject({
      owner_user_id: 'teammate-user',
      assigned_team_id: 'team-alpha',
      assigned_supervisor_user_id: 'supervisor-user',
      territory_id: 'territory-alpha',
    });
  });
});
