// PHASE 4: browser clients must never access entities/User/records.

import { readFileSync } from 'node:fs';
import {
  assertFails,
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
import {
  afterAll,
  beforeAll,
  describe,
  it,
} from 'vitest';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';

const BROWSER_USERS = [
  {
    label: 'Super Administrator',
    uid: 'super-admin-user',
    role: 'super_admin',
    status: 'active',
    teamId: null,
    supervisorId: null,
    territoryIds: [],
  },
  {
    label: 'Administrator',
    uid: 'admin-user',
    role: 'administrator',
    status: 'active',
    teamId: null,
    supervisorId: null,
    territoryIds: [],
  },
  {
    label: 'Supervisor',
    uid: 'supervisor-user',
    role: 'supervisor',
    status: 'active',
    teamId: 'team-alpha',
    supervisorId: null,
    territoryIds: ['territory-alpha'],
  },
  {
    label: 'Salesperson',
    uid: 'salesperson-user',
    role: 'salesperson',
    status: 'active',
    teamId: 'team-alpha',
    supervisorId: 'supervisor-user',
    territoryIds: ['territory-alpha'],
  },
  {
    label: 'Viewer Support',
    uid: 'viewer-support-user',
    role: 'viewer_support',
    status: 'active',
    teamId: 'team-support',
    supervisorId: null,
    territoryIds: ['territory-support'],
  },
  {
    label: 'Inactive',
    uid: 'inactive-user',
    role: 'salesperson',
    status: 'inactive',
    teamId: 'team-alpha',
    supervisorId: 'supervisor-user',
    territoryIds: ['territory-alpha'],
  },
];

let testEnvironment;

function legacyRoleFor(role) {
  return role === 'administrator'
    ? 'admin'
    : role;
}

function profileFor(user) {
  return {
    uid: user.uid,
    email: `${user.uid}@example.test`,
    displayName: `Test ${user.label}`,
    display_name: `Test ${user.label}`,

    role: legacyRoleFor(user.role),
    status: user.status,
    teamId: user.teamId,
    supervisorId: user.supervisorId,

    application_role: user.role,
    account_status: user.status,
    team_id: user.teamId,
    supervisor_user_id: user.supervisorId,
    territory_ids: user.territoryIds,

    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z',
  };
}

function firestoreFor(user) {
  return testEnvironment
    .authenticatedContext(user.uid, {
      role: legacyRoleFor(user.role),
      status: user.status,
      application_role: user.role,
      account_status: user.status,
      team_id: user.teamId,
      supervisor_user_id: user.supervisorId,
      territory_ids: user.territoryIds,
    })
    .firestore();
}

function userRecord(database, recordId) {
  return doc(
    database,
    'entities',
    'User',
    'records',
    recordId
  );
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

  await testEnvironment.clearFirestore();

  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      const database = context.firestore();

      for (const user of BROWSER_USERS) {
        await setDoc(
          doc(database, 'userProfiles', user.uid),
          profileFor(user)
        );
      }

      await setDoc(
        userRecord(database, 'directory-target'),
        {
          uid: 'directory-target',
          email: 'directory-target@example.test',
          display_name: 'Directory Target',
          application_role: 'salesperson',
          account_status: 'active',
        }
      );
    }
  );
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

for (const user of BROWSER_USERS) {
  describe(
    `entities/User browser denial — ${user.label}`,
    () => {
      it('denies get', async () => {
        const database = firestoreFor(user);

        await assertFails(
          getDoc(
            userRecord(database, 'directory-target')
          )
        );
      });

      it('denies list', async () => {
        const database = firestoreFor(user);

        await assertFails(
          getDocs(
            collection(
              database,
              'entities',
              'User',
              'records'
            )
          )
        );
      });

      it('denies create', async () => {
        const database = firestoreFor(user);

        await assertFails(
          setDoc(
            userRecord(
              database,
              `forged-${user.uid}`
            ),
            {
              uid: `forged-${user.uid}`,
              email: `forged-${user.uid}@example.test`,
              display_name: 'Forged Browser User',
              application_role: 'super_admin',
              account_status: 'active',
            }
          )
        );
      });

      it('denies update', async () => {
        const database = firestoreFor(user);

        await assertFails(
          updateDoc(
            userRecord(database, 'directory-target'),
            {
              application_role: 'super_admin',
            }
          )
        );
      });

      it('denies delete', async () => {
        const database = firestoreFor(user);

        await assertFails(
          deleteDoc(
            userRecord(database, 'directory-target')
          )
        );
      });
    }
  );
}
