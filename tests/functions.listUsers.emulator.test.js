import { afterEach, describe, expect, it, vi } from 'vitest';

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

async function createListUsersCallable(email = null) {
  clientNumber += 1;

  const app = initializeApp(
    {
      apiKey: 'phase4-functions-emulator-key',
      projectId: PROJECT_ID,
    },
    `phase4-list-users-${clientNumber}`
  );

  testApps.push(app);

  const auth = getAuth(app);
  const functions = getFunctions(app);

  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });

  connectFunctionsEmulator(functions, '127.0.0.1', 5001);

  if (email) {
    await signInWithEmailAndPassword(auth, email, PASSWORD);
  }

  return httpsCallable(functions, 'listUsers');
}

afterEach(async () => {
  const apps = testApps.splice(0);
  await Promise.all(apps.map((app) => deleteApp(app)));
});

describe('listUsers Firebase callable authorization', () => {
  it('denies anonymous callers', async () => {
    const listUsers = await createListUsersCallable();

    await expect(listUsers({})).rejects.toMatchObject({
      code: 'functions/unauthenticated',
    });
  });

  it('denies inactive accounts', async () => {
    const listUsers = await createListUsersCallable(
      'inactive@example.test'
    );

    await expect(listUsers({})).rejects.toMatchObject({
      code: 'functions/permission-denied',
    });
  });

  it('denies salesperson directory access', async () => {
    const listUsers = await createListUsersCallable(
      'salesperson@example.test'
    );

    await expect(listUsers({})).rejects.toMatchObject({
      code: 'functions/permission-denied',
    });
  });

  it('limits supervisors to their team and themselves', async () => {
    const listUsers = await createListUsersCallable(
      'supervisor@example.test'
    );

    const response = await listUsers({});
    const users = response.data.users;
    const ids = users.map((user) => user.id);

    expect(response.data.scope).toBe('team');
    expect(ids).toContain('supervisor-user');
    expect(ids).toContain('salesperson-user');
    expect(ids).not.toContain('admin-user');

    expect(
      users.every(
        (user) =>
          user.id === 'supervisor-user' ||
          user.team_id === 'team-alpha'
      )
    ).toBe(true);
  });

  it('allows administrators to list all seeded users', async () => {
    const listUsers = await createListUsersCallable(
      'admin@example.test'
    );

    const response = await listUsers({});
    const ids = response.data.users.map((user) => user.id);

    expect(response.data.scope).toBe('all');
    expect(ids).toEqual(
      expect.arrayContaining([
        'super-admin-user',
        'admin-user',
        'supervisor-user',
        'salesperson-user',
        'viewer-support-user',
        'inactive-user',
      ])
    );
  });
});
