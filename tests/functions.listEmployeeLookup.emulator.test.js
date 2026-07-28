// tests/functions.listEmployeeLookup.emulator.test.js
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  deleteApp,
  initializeApp,
} from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';
const PASSWORD = 'AtlasTest!2026';

vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000,
});

let clientNumber = 0;
const testApps = [];

const ALLOWED_FIELDS = new Set([
  'id',
  'uid',
  'email',
  'display_name',
  'full_name',
  'first_name',
  'last_name',
  'photo_url',
  'avatar_url',
  'application_role',
  'account_status',
]);

const FORBIDDEN_FIELDS = [
  'phone',
  'job_title',
  'team_id',
  'supervisor_user_id',
  'territory_ids',
  'last_login_date',
  'created_date',
  'updated_date',
  'requested_access_upgrade',
];

async function createLookupCallable(email = null) {
  clientNumber += 1;

  const app = initializeApp(
    {
      apiKey: 'phase4-employee-lookup-key',
      projectId: PROJECT_ID,
    },
    `phase4-employee-lookup-${clientNumber}`
  );

  testApps.push(app);

  const auth = getAuth(app);
  const functions = getFunctions(app);

  connectAuthEmulator(
    auth,
    'http://127.0.0.1:9099',
    {
      disableWarnings: true,
    }
  );

  connectFunctionsEmulator(
    functions,
    '127.0.0.1',
    5001
  );

  if (email) {
    await signInWithEmailAndPassword(
      auth,
      email,
      PASSWORD
    );
  }

  return httpsCallable(
    functions,
    'listEmployeeLookup'
  );
}

afterEach(async () => {
  const apps = testApps.splice(0);

  await Promise.all(
    apps.map((app) => deleteApp(app))
  );
});

describe.sequential(
  'listEmployeeLookup Firebase callable',
  () => {
    it('denies anonymous callers', async () => {
      const listEmployeeLookup =
        await createLookupCallable();

      await expect(
        listEmployeeLookup({})
      ).rejects.toMatchObject({
        code: 'functions/unauthenticated',
      });
    });

    it('denies inactive employee callers', async () => {
      const listEmployeeLookup =
        await createLookupCallable(
          'inactive@example.test'
        );

      await expect(
        listEmployeeLookup({})
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('allows active Salesperson callers', async () => {
      const listEmployeeLookup =
        await createLookupCallable(
          'salesperson@example.test'
        );

      const response = await listEmployeeLookup({});

      expect(response.data.scope).toBe(
        'employee_lookup'
      );

      expect(
        response.data.users.map((user) => user.id)
      ).toContain('salesperson-user');
    });

    it('allows active Viewer Support callers', async () => {
      const listEmployeeLookup =
        await createLookupCallable(
          'viewer@example.test'
        );

      const response = await listEmployeeLookup({});

      expect(
        response.data.users.map((user) => user.id)
      ).toContain('viewer-support-user');
    });

    it('returns sorted minimal records while preserving historical employees', async () => {
      const listEmployeeLookup =
        await createLookupCallable(
          'salesperson@example.test'
        );

      const response = await listEmployeeLookup({});
      const users = response.data.users;

      expect(
        users.map((user) => user.id)
      ).toContain('inactive-user');

      for (const user of users) {
        for (const key of Object.keys(user)) {
          expect(ALLOWED_FIELDS.has(key)).toBe(true);
        }

        for (const field of FORBIDDEN_FIELDS) {
          expect(
            Object.prototype.hasOwnProperty.call(
              user,
              field
            )
          ).toBe(false);
        }
      }

      const labels = users.map((user) =>
        user.display_name ||
        user.full_name ||
        user.email ||
        user.id
      );

      const sortedLabels = [...labels].sort(
        (left, right) =>
          left.localeCompare(right)
      );

      expect(labels).toEqual(sortedLabels);
    });
  }
);
