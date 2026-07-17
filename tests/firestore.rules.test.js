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
  'admin',
  'supervisor',
  'salesperson',
  'viewer_support',
];

let testEnvironment;

function profileFor(uid, role, status = 'active') {
  return {
    uid,
    email: `${uid}@example.test`,
    displayName: `Test ${role}`,
    role,
    status,
    teamId: role === 'salesperson' ? 'team-alpha' : null,
    supervisorId: role === 'salesperson' ? 'supervisor-user' : null,
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  };
}

function authenticatedFirestore(uid, role, status = 'active') {
  return testEnvironment
    .authenticatedContext(uid, { role, status })
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

      expect(snapshot.data().role).toBe(role);
      expect(snapshot.data().status).toBe('active');
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

    expect(snapshot.data().status).toBe('inactive');
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
