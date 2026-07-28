// tests/firestore.rules.test.js
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
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';
const ACTIVE_ROLES = [
  'super_admin',
  'administrator',
  'supervisor',
  'salesperson',
  'viewer_support',
];

let testEnvironment;

function legacyRoleFor(role) {
  return role === 'administrator' ? 'admin' : role;
}

function teamFor(role) {
  if (role === 'supervisor' || role === 'salesperson') {
    return 'team-alpha';
  }

  if (role === 'viewer_support') {
    return 'team-support';
  }

  return null;
}

function supervisorFor(role) {
  return role === 'salesperson' ? 'supervisor-user' : null;
}

function territoriesFor(role) {
  if (role === 'supervisor' || role === 'salesperson') {
    return ['territory-alpha'];
  }

  if (role === 'viewer_support') {
    return ['territory-support'];
  }

  return [];
}

function profileFor(uid, role, status = 'active') {
  const teamId = teamFor(role);
  const supervisorId = supervisorFor(role);
  const territoryIds = territoriesFor(role);

  return {
    uid,
    email: `${uid}@example.test`,
    displayName: `Test ${role}`,
    display_name: `Test ${role}`,

    // Phase 3 compatibility fields.
    role: legacyRoleFor(role),
    status,
    teamId,
    supervisorId,

    // Canonical Phase 4 authorization fields.
    application_role: role,
    account_status: status,
    team_id: teamId,
    supervisor_user_id: supervisorId,
    territory_ids: territoryIds,

    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  };
}

function authenticatedFirestore(uid, role, status = 'active') {
  const teamId = teamFor(role);
  const supervisorId = supervisorFor(role);
  const territoryIds = territoriesFor(role);

  return testEnvironment
    .authenticatedContext(uid, {
      role: legacyRoleFor(role),
      status,
      application_role: role,
      account_status: status,
      team_id: teamId,
      supervisor_user_id: supervisorId,
      territory_ids: territoryIds,
    })
    .firestore();
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

    for (const role of ACTIVE_ROLES) {
      const uid = `${role}-user`;
      await setDoc(
        doc(adminFirestore, 'userProfiles', uid),
        profileFor(uid, role)
      );
    }

    await setDoc(
      doc(adminFirestore, 'userProfiles', 'inactive-user'),
      profileFor('inactive-user', 'salesperson', 'inactive')
    );
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe('userProfiles default-deny rules', () => {
  it('denies anonymous profile reads', async () => {
    const anonymousFirestore = testEnvironment
      .unauthenticatedContext()
      .firestore();

    await assertFails(
      getDoc(doc(anonymousFirestore, 'userProfiles', 'salesperson-user'))
    );
  });

  it.each(ACTIVE_ROLES)(
    'allows an authenticated %s account to read only its own profile',
    async (role) => {
      const uid = `${role}-user`;
      const roleFirestore = authenticatedFirestore(uid, role);

      const snapshot = await assertSucceeds(
        getDoc(doc(roleFirestore, 'userProfiles', uid))
      );

      expect(snapshot.data().application_role).toBe(role);
      expect(snapshot.data().account_status).toBe('active');
    }
  );

  it.each(ACTIVE_ROLES)(
    'denies an authenticated %s account access to another profile',
    async (role) => {
      const uid = `${role}-user`;
      const roleFirestore = authenticatedFirestore(uid, role);

      await assertFails(
        getDoc(doc(roleFirestore, 'userProfiles', 'inactive-user'))
      );
    }
  );

  it('allows an inactive account to read only its own status profile', async () => {
    const inactiveFirestore = authenticatedFirestore(
      'inactive-user',
      'salesperson',
      'inactive'
    );

    const snapshot = await assertSucceeds(
      getDoc(doc(inactiveFirestore, 'userProfiles', 'inactive-user'))
    );

    expect(snapshot.data().account_status).toBe('inactive');
  });

  it.each(ACTIVE_ROLES)(
    'denies profile listing to the %s browser client',
    async (role) => {
      const uid = `${role}-user`;
      const roleFirestore = authenticatedFirestore(uid, role);

      await assertFails(
        getDocs(collection(roleFirestore, 'userProfiles'))
      );
    }
  );

  it.each(ACTIVE_ROLES)(
    'denies profile creation by the %s browser client',
    async (role) => {
      const uid = `${role}-user`;
      const roleFirestore = authenticatedFirestore(uid, role);

      await assertFails(
        setDoc(
          doc(roleFirestore, 'userProfiles', 'forged-user'),
          profileFor('forged-user', 'super_admin')
        )
      );
    }
  );

  it.each(ACTIVE_ROLES)(
    'denies profile changes by the %s browser client',
    async (role) => {
      const uid = `${role}-user`;
      const roleFirestore = authenticatedFirestore(uid, role);

      await assertFails(
        updateDoc(doc(roleFirestore, 'userProfiles', uid), {
          role: 'super_admin',
          status: 'active',
        })
      );
    }
  );

  it.each(ACTIVE_ROLES)(
    'denies profile deletion by the %s browser client',
    async (role) => {
      const uid = `${role}-user`;
      const roleFirestore = authenticatedFirestore(uid, role);

      await assertFails(
        deleteDoc(doc(roleFirestore, 'userProfiles', uid))
      );
    }
  );

  it('keeps unrelated collections default-deny', async () => {
    const salespersonFirestore = authenticatedFirestore(
      'salesperson-user',
      'salesperson'
    );

    await assertFails(
      getDoc(doc(salespersonFirestore, 'leads', 'blocked-lead'))
    );
    await assertFails(
      setDoc(doc(salespersonFirestore, 'leads', 'blocked-lead'), {
        ownerId: 'salesperson-user',
      })
    );
  });
});

describe('Phase 4 entity authorization baseline', () => {
  function leadDocument(database, recordId = 'lead-001') {
    return doc(database, 'entities', 'Lead', 'records', recordId);
  }

  function leadCollection(database) {
    return collection(database, 'entities', 'Lead', 'records');
  }

  function leadData({
    name,
    ownerUserId,
    teamId = null,
    supervisorUserId = null,
    territoryId = null,
    status = 'new',
  }) {
    return {
      name,
      status,
      owner_user_id: ownerUserId,
      assigned_team_id: teamId,
      assigned_supervisor_user_id: supervisorUserId,
      territory_id: territoryId,
    };
  }

  it('denies anonymous entity reads, lists, and writes', async () => {
    const anonymousFirestore = testEnvironment
      .unauthenticatedContext()
      .firestore();

    await assertFails(getDoc(leadDocument(anonymousFirestore)));
    await assertFails(getDocs(leadCollection(anonymousFirestore)));
    await assertFails(
      setDoc(
        leadDocument(anonymousFirestore),
        leadData({
          name: 'Blocked Lead',
          ownerUserId: 'anonymous-user',
        })
      )
    );
  });

  it('allows the Super Administrator full entity CRUD', async () => {
    const database = authenticatedFirestore(
      'super_admin-user',
      'super_admin'
    );
    const recordReference = leadDocument(
      database,
      'super-admin-lead'
    );

    await assertSucceeds(
      setDoc(
        recordReference,
        leadData({
          name: 'Super Administrator Lead',
          ownerUserId: 'salesperson-user',
          teamId: 'team-alpha',
          supervisorUserId: 'supervisor-user',
          territoryId: 'territory-alpha',
        })
      )
    );

    await assertSucceeds(getDoc(recordReference));

    await assertSucceeds(
      updateDoc(recordReference, {
        status: 'qualified',
      })
    );

    await assertSucceeds(deleteDoc(recordReference));
  });

  it('allows the Administrator operational CRUD except direct deletion', async () => {
    const database = authenticatedFirestore(
      'administrator-user',
      'administrator'
    );
    const recordReference = leadDocument(
      database,
      'administrator-lead'
    );

    await assertSucceeds(
      setDoc(
        recordReference,
        leadData({
          name: 'Administrator Lead',
          ownerUserId: 'salesperson-user',
          teamId: 'team-alpha',
          supervisorUserId: 'supervisor-user',
          territoryId: 'territory-alpha',
        })
      )
    );

    await assertSucceeds(getDoc(recordReference));

    await assertSucceeds(
      updateDoc(recordReference, {
        status: 'qualified',
      })
    );

    await assertFails(deleteDoc(recordReference));
  });

  it('allows a salesperson to manage an owned record without deleting it', async () => {
    const database = authenticatedFirestore(
      'salesperson-user',
      'salesperson'
    );
    const recordReference = leadDocument(
      database,
      'salesperson-owned-lead'
    );

    await assertSucceeds(
      setDoc(
        recordReference,
        leadData({
          name: 'Salesperson Owned Lead',
          ownerUserId: 'salesperson-user',
          teamId: 'team-alpha',
          supervisorUserId: 'supervisor-user',
          territoryId: 'territory-alpha',
        })
      )
    );

    await assertSucceeds(getDoc(recordReference));

    await assertSucceeds(
      updateDoc(recordReference, {
        status: 'qualified',
      })
    );

    await assertFails(deleteDoc(recordReference));
  });

  it('denies Viewer Support access to protected CRM records', async () => {
    const database = authenticatedFirestore(
      'viewer_support-user',
      'viewer_support'
    );

    await assertFails(
      setDoc(
        leadDocument(database, 'viewer-support-lead'),
        leadData({
          name: 'Viewer Support Lead',
          ownerUserId: 'viewer_support-user',
          teamId: 'team-support',
          territoryId: 'territory-support',
        })
      )
    );

    await assertFails(getDocs(leadCollection(database)));
  });

  it('denies inactive accounts access to CRM entities', async () => {
    const database = authenticatedFirestore(
      'inactive-user',
      'salesperson',
      'inactive'
    );
    const recordReference = leadDocument(
      database,
      'inactive-user-lead'
    );

    await assertFails(
      setDoc(
        recordReference,
        leadData({
          name: 'Inactive User Lead',
          ownerUserId: 'inactive-user',
          teamId: 'team-alpha',
          supervisorUserId: 'supervisor-user',
          territoryId: 'territory-alpha',
        })
      )
    );

    await assertFails(getDoc(recordReference));
    await assertFails(getDocs(leadCollection(database)));
  });
});
