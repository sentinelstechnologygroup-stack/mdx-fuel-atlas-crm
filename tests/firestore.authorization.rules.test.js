// tests/firestore.authorization.rules.test.js
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';

const USERS = {
  superAdmin: {
    uid: 'super-admin-user',
    role: 'super_admin',
    teamId: null,
    supervisorId: null,
    territoryIds: [],
  },
  administrator: {
    uid: 'administrator-user',
    role: 'administrator',
    teamId: null,
    supervisorId: null,
    territoryIds: [],
  },
  supervisor: {
    uid: 'supervisor-user',
    role: 'supervisor',
    teamId: 'team-alpha',
    supervisorId: null,
    territoryIds: ['territory-alpha'],
  },
  salesperson: {
    uid: 'salesperson-user',
    role: 'salesperson',
    teamId: 'team-alpha',
    supervisorId: 'supervisor-user',
    territoryIds: ['territory-alpha'],
  },
  teammate: {
    uid: 'teammate-user',
    role: 'salesperson',
    teamId: 'team-alpha',
    supervisorId: 'supervisor-user',
    territoryIds: ['territory-alpha'],
  },
  otherSalesperson: {
    uid: 'other-salesperson-user',
    role: 'salesperson',
    teamId: 'team-beta',
    supervisorId: 'other-supervisor-user',
    territoryIds: ['territory-beta'],
  },
  viewerSupport: {
    uid: 'viewer-support-user',
    role: 'viewer_support',
    teamId: 'team-support',
    supervisorId: null,
    territoryIds: ['territory-support'],
  },
  inactive: {
    uid: 'inactive-user',
    role: 'salesperson',
    status: 'inactive',
    teamId: 'team-alpha',
    supervisorId: 'supervisor-user',
    territoryIds: ['territory-alpha'],
  },
};

let testEnvironment;

function legacyRoleFor(role) {
  return role === 'administrator' ? 'admin' : role;
}

function profileFor(user) {
  const status = user.status ?? 'active';

  return {
    uid: user.uid,
    email: `${user.uid}@example.test`,
    displayName: `Test ${user.role}`,
    display_name: `Test ${user.role}`,

    // Phase 3 compatibility fields.
    role: legacyRoleFor(user.role),
    status,
    teamId: user.teamId,
    supervisorId: user.supervisorId,

    // Canonical Phase 4 authorization fields.
    application_role: user.role,
    account_status: status,
    team_id: user.teamId,
    supervisor_user_id: user.supervisorId,
    territory_ids: user.territoryIds,

    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  };
}

function firestoreFor(user) {
  const status = user.status ?? 'active';

  return testEnvironment
    .authenticatedContext(user.uid, {
      role: legacyRoleFor(user.role),
      status,
      application_role: user.role,
      account_status: status,
      team_id: user.teamId,
      supervisor_user_id: user.supervisorId,
      territory_ids: user.territoryIds,
    })
    .firestore();
}

function leadDocument(database, recordId) {
  return doc(database, 'entities', 'Lead', 'records', recordId);
}

function leadCollection(database) {
  return collection(database, 'entities', 'Lead', 'records');
}

function leadData({
  name,
  ownerUserId,
  teamId,
  supervisorUserId,
  territoryId,
  status = 'new',
}) {
  return {
    full_name: name,
    lead_status: status,
    owner_user_id: ownerUserId,
    assigned_team_id: teamId,
    assigned_supervisor_user_id: supervisorUserId,
    territory_id: territoryId,
    ownership_status: ownerUserId ? 'assigned' : 'unassigned',
    created_by_user_id: ownerUserId,
    last_modified_by_user_id: ownerUserId,
  };
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const adminFirestore = context.firestore();

    for (const user of Object.values(USERS)) {
      await setDoc(
        doc(adminFirestore, 'userProfiles', user.uid),
        profileFor(user)
      );
    }

    await setDoc(
      leadDocument(adminFirestore, 'salesperson-own-lead'),
      leadData({
        name: 'Salesperson Own Lead',
        ownerUserId: USERS.salesperson.uid,
        teamId: 'team-alpha',
        supervisorUserId: USERS.supervisor.uid,
        territoryId: 'territory-alpha',
      })
    );

    await setDoc(
      leadDocument(adminFirestore, 'same-team-lead'),
      leadData({
        name: 'Same Team Lead',
        ownerUserId: USERS.teammate.uid,
        teamId: 'team-alpha',
        supervisorUserId: USERS.supervisor.uid,
        territoryId: 'territory-alpha',
      })
    );

    await setDoc(
      leadDocument(adminFirestore, 'other-team-lead'),
      leadData({
        name: 'Other Team Lead',
        ownerUserId: USERS.otherSalesperson.uid,
        teamId: 'team-beta',
        supervisorUserId: 'other-supervisor-user',
        territoryId: 'territory-beta',
      })
    );
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe('Phase 4 active-account enforcement', () => {
  it('denies inactive accounts all CRM entity access', async () => {
    const database = firestoreFor(USERS.inactive);

    await assertFails(
      getDoc(leadDocument(database, 'salesperson-own-lead'))
    );

    await assertFails(
      setDoc(
        leadDocument(database, 'inactive-created-lead'),
        leadData({
          name: 'Inactive Created Lead',
          ownerUserId: USERS.inactive.uid,
          teamId: 'team-alpha',
          supervisorUserId: USERS.supervisor.uid,
          territoryId: 'territory-alpha',
        })
      )
    );
  });
});

describe('Phase 4 record-scope reads', () => {
  it('allows a salesperson to read only their own assigned lead', async () => {
    const database = firestoreFor(USERS.salesperson);

    await assertSucceeds(
      getDoc(leadDocument(database, 'salesperson-own-lead'))
    );
    await assertFails(getDoc(leadDocument(database, 'same-team-lead')));
    await assertFails(getDoc(leadDocument(database, 'other-team-lead')));
  });

  it('allows a supervisor to read team records but not another team', async () => {
    const database = firestoreFor(USERS.supervisor);

    await assertSucceeds(
      getDoc(leadDocument(database, 'salesperson-own-lead'))
    );
    await assertSucceeds(getDoc(leadDocument(database, 'same-team-lead')));
    await assertFails(getDoc(leadDocument(database, 'other-team-lead')));
  });

  it.each([
    ['Super Administrator', USERS.superAdmin],
    ['Administrator', USERS.administrator],
  ])('allows %s system-wide operational reads', async (_label, user) => {
    const database = firestoreFor(user);

    await assertSucceeds(
      getDoc(leadDocument(database, 'salesperson-own-lead'))
    );
    await assertSucceeds(getDoc(leadDocument(database, 'same-team-lead')));
    await assertSucceeds(getDoc(leadDocument(database, 'other-team-lead')));
  });

  it('denies Viewer Support CRM reads unless separately authorized', async () => {
    const database = firestoreFor(USERS.viewerSupport);

    await assertFails(
      getDoc(leadDocument(database, 'salesperson-own-lead'))
    );
  });
});

describe('Phase 4 scoped list queries', () => {
  it('allows a salesperson owner-constrained query and denies an unrestricted list', async () => {
    const database = firestoreFor(USERS.salesperson);

    const ownQuery = query(
      leadCollection(database),
      where('owner_user_id', '==', USERS.salesperson.uid)
    );

    const snapshot = await assertSucceeds(getDocs(ownQuery));

    expect(snapshot.docs.map((item) => item.id)).toEqual([
      'salesperson-own-lead',
    ]);

    await assertFails(getDocs(leadCollection(database)));
  });

  it('allows a supervisor team-constrained query and denies an unrestricted list', async () => {
    const database = firestoreFor(USERS.supervisor);

    const teamQuery = query(
      leadCollection(database),
      where('assigned_team_id', '==', 'team-alpha')
    );

    const snapshot = await assertSucceeds(getDocs(teamQuery));

    expect(snapshot.docs.map((item) => item.id).sort()).toEqual([
      'salesperson-own-lead',
      'same-team-lead',
    ]);

    await assertFails(getDocs(leadCollection(database)));
  });

  it.each([
    ['Super Administrator', USERS.superAdmin],
    ['Administrator', USERS.administrator],
  ])('allows %s unrestricted operational lists', async (_label, user) => {
    const database = firestoreFor(user);
    const snapshot = await assertSucceeds(
      getDocs(leadCollection(database))
    );

    expect(snapshot.size).toBe(3);
  });

  it('denies Viewer Support CRM list access', async () => {
    const database = firestoreFor(USERS.viewerSupport);

    await assertFails(getDocs(leadCollection(database)));
  });
});

describe('Phase 4 create and protected ownership enforcement', () => {
  it('allows a salesperson to create an owned record in their assignment scope', async () => {
    const database = firestoreFor(USERS.salesperson);

    await assertSucceeds(
      setDoc(
        leadDocument(database, 'salesperson-created-lead'),
        leadData({
          name: 'Salesperson Created Lead',
          ownerUserId: USERS.salesperson.uid,
          teamId: 'team-alpha',
          supervisorUserId: USERS.supervisor.uid,
          territoryId: 'territory-alpha',
        })
      )
    );
  });

  it('denies forged salesperson ownership, team, and supervisor fields', async () => {
    const database = firestoreFor(USERS.salesperson);

    await assertFails(
      setDoc(
        leadDocument(database, 'forged-salesperson-lead'),
        leadData({
          name: 'Forged Salesperson Lead',
          ownerUserId: USERS.otherSalesperson.uid,
          teamId: 'team-beta',
          supervisorUserId: 'other-supervisor-user',
          territoryId: 'territory-beta',
        })
      )
    );
  });

  it('allows a supervisor to create a record for their managed team', async () => {
    const database = firestoreFor(USERS.supervisor);

    await assertSucceeds(
      setDoc(
        leadDocument(database, 'supervisor-created-lead'),
        leadData({
          name: 'Supervisor Created Lead',
          ownerUserId: USERS.teammate.uid,
          teamId: 'team-alpha',
          supervisorUserId: USERS.supervisor.uid,
          territoryId: 'territory-alpha',
        })
      )
    );
  });

  it('denies a supervisor creating a record for another team', async () => {
    const database = firestoreFor(USERS.supervisor);

    await assertFails(
      setDoc(
        leadDocument(database, 'forged-supervisor-lead'),
        leadData({
          name: 'Forged Supervisor Lead',
          ownerUserId: USERS.otherSalesperson.uid,
          teamId: 'team-beta',
          supervisorUserId: 'other-supervisor-user',
          territoryId: 'territory-beta',
        })
      )
    );
  });

  it('denies Viewer Support CRM creates', async () => {
    const database = firestoreFor(USERS.viewerSupport);

    await assertFails(
      setDoc(
        leadDocument(database, 'viewer-created-lead'),
        leadData({
          name: 'Viewer Created Lead',
          ownerUserId: USERS.viewerSupport.uid,
          teamId: 'team-support',
          supervisorUserId: null,
          territoryId: 'territory-support',
        })
      )
    );
  });
});

describe('Phase 4 update, reassignment, and deletion enforcement', () => {
  it('allows a salesperson to edit an owned lead without changing assignment fields', async () => {
    const database = firestoreFor(USERS.salesperson);

    await assertSucceeds(
      updateDoc(leadDocument(database, 'salesperson-own-lead'), {
        lead_status: 'qualified',
        last_modified_by_user_id: USERS.salesperson.uid,
      })
    );
  });

  it('denies direct salesperson reassignment of an owned lead', async () => {
    const database = firestoreFor(USERS.salesperson);

    await assertFails(
      updateDoc(leadDocument(database, 'salesperson-own-lead'), {
        owner_user_id: USERS.teammate.uid,
        assigned_team_id: 'team-alpha',
        assigned_supervisor_user_id: USERS.supervisor.uid,
      })
    );
  });

  it('allows a supervisor to edit a team lead but denies direct transfer fields', async () => {
    const database = firestoreFor(USERS.supervisor);

    await assertSucceeds(
      updateDoc(leadDocument(database, 'same-team-lead'), {
        lead_status: 'contacted',
        last_modified_by_user_id: USERS.supervisor.uid,
      })
    );

    await assertFails(
      updateDoc(leadDocument(database, 'same-team-lead'), {
        owner_user_id: USERS.otherSalesperson.uid,
        assigned_team_id: 'team-beta',
        assigned_supervisor_user_id: 'other-supervisor-user',
      })
    );
  });

  it('denies Administrator direct assignment-field changes', async () => {
    const database = firestoreFor(USERS.administrator);

    await assertFails(
      updateDoc(leadDocument(database, 'same-team-lead'), {
        owner_user_id: USERS.otherSalesperson.uid,
        assigned_team_id: 'team-beta',
        assigned_supervisor_user_id: 'other-supervisor-user',
      })
    );
  });

  it('allows only the Super Administrator to directly delete a CRM record', async () => {
    await assertFails(
      deleteDoc(
        leadDocument(
          firestoreFor(USERS.administrator),
          'salesperson-own-lead'
        )
      )
    );

    await assertFails(
      deleteDoc(
        leadDocument(
          firestoreFor(USERS.supervisor),
          'salesperson-own-lead'
        )
      )
    );

    await assertFails(
      deleteDoc(
        leadDocument(
          firestoreFor(USERS.salesperson),
          'salesperson-own-lead'
        )
      )
    );

    await assertSucceeds(
      deleteDoc(
        leadDocument(
          firestoreFor(USERS.superAdmin),
          'salesperson-own-lead'
        )
      )
    );
  });
});
