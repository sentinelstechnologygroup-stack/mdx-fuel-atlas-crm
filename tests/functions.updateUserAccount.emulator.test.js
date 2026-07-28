// tests/functions.updateUserAccount.emulator.test.js
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

async function createCallables(email = null) {
  clientNumber += 1;

  const app = initializeApp(
    {
      apiKey: 'phase4-update-user-account-key',
      projectId: PROJECT_ID,
    },
    `phase4-update-user-${clientNumber}`
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

  return {
    listUsers: httpsCallable(functions, 'listUsers'),
    updateUserAccount: httpsCallable(
      functions,
      'updateUserAccount'
    ),
  };
}

afterEach(async () => {
  const apps = testApps.splice(0);
  await Promise.all(
    apps.map((app) => deleteApp(app))
  );
});

describe.sequential(
  'updateUserAccount Firebase callable authorization',
  () => {
    it('denies anonymous callers', async () => {
      const { updateUserAccount } =
        await createCallables();

      await expect(
        updateUserAccount({
          action: 'role',
          target_user_id: 'viewer-support-user',
          value: 'salesperson',
        })
      ).rejects.toMatchObject({
        code: 'functions/unauthenticated',
      });
    });

    it('denies non-administrative callers', async () => {
      const { updateUserAccount } =
        await createCallables(
          'salesperson@example.test'
        );

      await expect(
        updateUserAccount({
          action: 'team',
          target_user_id: 'viewer-support-user',
          value: 'team-alpha',
        })
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('allows an Administrator to change a lower-tier role', async () => {
      const {
        updateUserAccount,
      } = await createCallables(
        'admin@example.test'
      );

      try {
        const response = await updateUserAccount({
          action: 'role',
          target_user_id: 'viewer-support-user',
          value: 'salesperson',
        });

        expect(response.data).toMatchObject({
          success: true,
          action: 'role',
          user: {
            id: 'viewer-support-user',
            application_role: 'salesperson',
          },
        });
      } finally {
        await updateUserAccount({
          action: 'role',
          target_user_id: 'viewer-support-user',
          value: 'viewer_support',
        }).catch(() => undefined);
      }
    });

    it('prevents an Administrator from assigning or managing Administrator-tier accounts', async () => {
      const {
        updateUserAccount,
      } = await createCallables(
        'admin@example.test'
      );

      await expect(
        updateUserAccount({
          action: 'role',
          target_user_id: 'viewer-support-user',
          value: 'administrator',
        })
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });

      await expect(
        updateUserAccount({
          action: 'team',
          target_user_id: 'admin-user',
          value: null,
        })
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('protects the final active Super Administrator', async () => {
      const {
        updateUserAccount,
      } = await createCallables(
        'superadmin@example.test'
      );

      await expect(
        updateUserAccount({
          action: 'role',
          target_user_id: 'super-admin-user',
          value: 'administrator',
        })
      ).rejects.toMatchObject({
        code: 'functions/failed-precondition',
      });

      await expect(
        updateUserAccount({
          action: 'suspend',
          target_user_id: 'super-admin-user',
          reason: 'Invalid self-suspension test',
        })
      ).rejects.toMatchObject({
        code: 'functions/failed-precondition',
      });
    });

    it('validates supervisor authority', async () => {
      const {
        updateUserAccount,
      } = await createCallables(
        'superadmin@example.test'
      );

      await expect(
        updateUserAccount({
          action: 'supervisor',
          target_user_id: 'viewer-support-user',
          value: 'salesperson-user',
        })
      ).rejects.toMatchObject({
        code: 'functions/failed-precondition',
      });

      await expect(
        updateUserAccount({
          action: 'supervisor',
          target_user_id: 'viewer-support-user',
          value: 'viewer-support-user',
        })
      ).rejects.toMatchObject({
        code: 'functions/failed-precondition',
      });
    });

    it('updates and restores team, supervisor, and territory assignments', async () => {
      const {
        listUsers,
        updateUserAccount,
      } = await createCallables(
        'superadmin@example.test'
      );

      const originalResponse = await listUsers({});
      const original = originalResponse.data.users.find(
        (user) => user.id === 'salesperson-user'
      );

      expect(original).toBeDefined();

      try {
        await updateUserAccount({
          action: 'supervisor',
          target_user_id: 'salesperson-user',
          value: null,
        });

        const clearedSupervisorResponse =
          await listUsers({});

        const clearedSupervisor =
          clearedSupervisorResponse.data.users.find(
            (user) => user.id === 'salesperson-user'
          );

        expect(
          clearedSupervisor?.supervisor_user_id
        ).toBeNull();

        await updateUserAccount({
          action: 'team',
          target_user_id: 'salesperson-user',
          value: 'team-bravo',
        });

        const supervisorResponse =
          await updateUserAccount({
            action: 'supervisor',
            target_user_id: 'salesperson-user',
            value: 'admin-user',
          });

        expect(
          supervisorResponse.data.user
        ).toMatchObject({
          team_id: 'team-bravo',
          supervisor_user_id: 'admin-user',
        });

        const territoryResponse =
          await updateUserAccount({
            action: 'territory',
            target_user_id: 'salesperson-user',
            value: [
              'territory-bravo',
              'territory-alpha',
              'territory-bravo',
            ],
          });

        expect(
          territoryResponse.data.user.territory_ids
        ).toEqual([
          'territory-bravo',
          'territory-alpha',
        ]);
      } finally {
        await updateUserAccount({
          action: 'supervisor',
          target_user_id: 'salesperson-user',
          value: null,
        }).catch(() => undefined);

        await updateUserAccount({
          action: 'team',
          target_user_id: 'salesperson-user',
          value: original?.team_id ?? null,
        }).catch(() => undefined);

        await updateUserAccount({
          action: 'supervisor',
          target_user_id: 'salesperson-user',
          value: original?.supervisor_user_id ?? null,
        }).catch(() => undefined);

        await updateUserAccount({
          action: 'territory',
          target_user_id: 'salesperson-user',
          value: original?.territory_ids ?? [],
        }).catch(() => undefined);
      }
    });

    it('requires a reason to suspend and allows reactivation', async () => {
      const {
        updateUserAccount,
      } = await createCallables(
        'admin@example.test'
      );

      await expect(
        updateUserAccount({
          action: 'suspend',
          target_user_id: 'viewer-support-user',
        })
      ).rejects.toMatchObject({
        code: 'functions/invalid-argument',
      });

      try {
        const suspended = await updateUserAccount({
          action: 'suspend',
          target_user_id: 'viewer-support-user',
          reason: 'Targeted authorization test',
        });

        expect(
          suspended.data.user.account_status
        ).toBe('suspended');

        const reactivated = await updateUserAccount({
          action: 'reactivate',
          target_user_id: 'viewer-support-user',
        });

        expect(
          reactivated.data.user.account_status
        ).toBe('active');
      } finally {
        await updateUserAccount({
          action: 'reactivate',
          target_user_id: 'viewer-support-user',
        }).catch(() => undefined);
      }
    });
  }
);
