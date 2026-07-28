// tests/functions.selfProfile.emulator.test.js
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
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
} from 'firebase/firestore';
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

async function createClient(email = null) {
  clientNumber += 1;

  const app = initializeApp(
    {
      apiKey: 'phase4-self-profile-key',
      projectId: PROJECT_ID,
    },
    `phase4-self-profile-${clientNumber}`
  );

  testApps.push(app);

  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app);

  connectAuthEmulator(
    auth,
    'http://127.0.0.1:9099',
    {
      disableWarnings: true,
    }
  );

  connectFirestoreEmulator(
    firestore,
    '127.0.0.1',
    8080
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
    firestore,
    requestAccessUpgrade: httpsCallable(
      functions,
      'requestAccessUpgrade'
    ),
    updateCurrentProfile: httpsCallable(
      functions,
      'updateCurrentProfile'
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
  'self-profile Firebase callables',
  () => {
    it('denies anonymous profile updates', async () => {
      const client = await createClient();

      await expect(
        client.updateCurrentProfile({
          full_name: 'Anonymous User',
        })
      ).rejects.toMatchObject({
        code: 'functions/unauthenticated',
      });
    });

    it('denies inactive profile updates', async () => {
      const client = await createClient(
        'inactive@example.test'
      );

      await expect(
        client.updateCurrentProfile({
          full_name: 'Inactive User',
        })
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('updates only the active employee name', async () => {
      const client = await createClient(
        'salesperson@example.test'
      );

      const response =
        await client.updateCurrentProfile({
          full_name: 'Updated Salesperson',
        });

      expect(response.data.user).toMatchObject({
        id: 'salesperson-user',
        full_name: 'Updated Salesperson',
        display_name: 'Updated Salesperson',
        application_role: 'salesperson',
        account_status: 'active',
      });

      const snapshot = await getDoc(
        doc(
          client.firestore,
          'userProfiles',
          'salesperson-user'
        )
      );

      expect(snapshot.data()).toMatchObject({
        full_name: 'Updated Salesperson',
        display_name: 'Updated Salesperson',
        application_role: 'salesperson',
        account_status: 'active',
      });
    });

    it('rejects invalid or privileged profile fields', async () => {
      const client = await createClient(
        'salesperson@example.test'
      );

      await expect(
        client.updateCurrentProfile({
          full_name: '   ',
        })
      ).rejects.toMatchObject({
        code: 'functions/invalid-argument',
      });

      await expect(
        client.updateCurrentProfile({
          full_name: 'Forged Administrator',
          application_role: 'super_admin',
        })
      ).rejects.toMatchObject({
        code: 'functions/invalid-argument',
      });
    });

    it('denies anonymous access-upgrade requests', async () => {
      const client = await createClient();

      await expect(
        client.requestAccessUpgrade({})
      ).rejects.toMatchObject({
        code: 'functions/unauthenticated',
      });
    });

    it('denies inactive access-upgrade requests', async () => {
      const client = await createClient(
        'inactive@example.test'
      );

      await expect(
        client.requestAccessUpgrade({})
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('submits an authenticated self-service request', async () => {
      const client = await createClient(
        'salesperson@example.test'
      );

      const response =
        await client.requestAccessUpgrade({});

      expect(response.data).toMatchObject({
        request_status: 'submitted',
        user: {
          id: 'salesperson-user',
          requested_access_upgrade: true,
          application_role: 'salesperson',
        },
      });

      const snapshot = await getDoc(
        doc(
          client.firestore,
          'userProfiles',
          'salesperson-user'
        )
      );

      expect(
        snapshot.data().requested_access_upgrade
      ).toBe(true);
    });

    it('is idempotent and rejects target data', async () => {
      const client = await createClient(
        'salesperson@example.test'
      );

      const repeated =
        await client.requestAccessUpgrade({});

      expect(repeated.data.request_status).toBe(
        'existing'
      );

      await expect(
        client.requestAccessUpgrade({
          target_user_id: 'admin-user',
        })
      ).rejects.toMatchObject({
        code: 'functions/invalid-argument',
      });
    });
  }
);
