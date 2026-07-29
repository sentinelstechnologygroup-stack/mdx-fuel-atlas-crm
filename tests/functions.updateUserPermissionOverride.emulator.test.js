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
  collection,
  connectFirestoreEmulator,
  getDocs,
  getFirestore,
  query,
  where,
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
      apiKey: 'phase6-permission-override-key',
      projectId: PROJECT_ID,
    },
    `phase6-permission-override-${clientNumber}`
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
    getEffectivePermissions: httpsCallable(
      functions,
      'getEffectivePermissions'
    ),
    updateUserPermissionOverride: httpsCallable(
      functions,
      'updateUserPermissionOverride'
    ),
  };
}

function upsertPayload(targetUserId) {
  return {
    action: 'upsert',
    target_user_id: targetUserId,
    module_key: 'leads',
    override_mode: 'replace',
    record_scope: 'own',
    can_view: true,
    can_create: false,
    can_edit: false,
    can_delete: false,
    can_assign: false,
    can_export: false,
    can_approve: false,
    can_manage_configuration: false,
    expiration_date: '2027-07-29T00:00:00.000Z',
    reason: 'Phase 6 targeted emulator validation.',
  };
}

async function matchingOverrides(
  firestore,
  targetUserId
) {
  return getDocs(
    query(
      collection(
        firestore,
        'entities',
        'UserPermissionOverride',
        'records'
      ),
      where('user_id', '==', targetUserId),
      where('module_key', '==', 'leads')
    )
  );
}

async function matchingAudits(
  firestore,
  overrideId,
  action
) {
  return getDocs(
    query(
      collection(
        firestore,
        'entities',
        'AuditLog',
        'records'
      ),
      where('override_id', '==', overrideId),
      where('action', '==', action)
    )
  );
}

afterEach(async () => {
  const apps = testApps.splice(0);

  await Promise.all(
    apps.map((app) => deleteApp(app))
  );
});

describe.sequential(
  'updateUserPermissionOverride Firebase callable',
  () => {
    it('denies anonymous callers', async () => {
      const client = await createClient();

      await expect(
        client.updateUserPermissionOverride(
          upsertPayload('salesperson-user')
        )
      ).rejects.toMatchObject({
        code: 'functions/unauthenticated',
      });
    });

    it('denies inactive callers', async () => {
      const client = await createClient(
        'inactive@example.test'
      );

      await expect(
        client.updateUserPermissionOverride(
          upsertPayload('salesperson-user')
        )
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('denies non-administrator callers', async () => {
      const client = await createClient(
        'salesperson@example.test'
      );

      await expect(
        client.updateUserPermissionOverride(
          upsertPayload('viewer-support-user')
        )
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('blocks administrator self-management', async () => {
      const client = await createClient(
        'admin@example.test'
      );

      await expect(
        client.updateUserPermissionOverride(
          upsertPayload('admin-user')
        )
      ).rejects.toMatchObject({
        code: 'functions/failed-precondition',
      });
    });

    it('blocks administrators from managing super administrators', async () => {
      const client = await createClient(
        'admin@example.test'
      );

      await expect(
        client.updateUserPermissionOverride(
          upsertPayload('super-admin-user')
        )
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('rejects invalid permission override input', async () => {
      const client = await createClient(
        'admin@example.test'
      );

      await expect(
        client.updateUserPermissionOverride({
          ...upsertPayload('salesperson-user'),
          module_key: 'unsupported-module',
        })
      ).rejects.toMatchObject({
        code: 'functions/invalid-argument',
      });

      await expect(
        client.updateUserPermissionOverride({
          ...upsertPayload('salesperson-user'),
          reason: '   ',
        })
      ).rejects.toMatchObject({
        code: 'functions/invalid-argument',
      });

      await expect(
        client.updateUserPermissionOverride({
          ...upsertPayload('salesperson-user'),
          can_view: 'yes',
        })
      ).rejects.toMatchObject({
        code: 'functions/invalid-argument',
      });
    });

    it('allows an administrator to upsert and deactivate a subordinate override', async () => {
      const client = await createClient(
        'admin@example.test'
      );

      const upsertResponse =
        await client.updateUserPermissionOverride(
          upsertPayload('salesperson-user')
        );

      expect(upsertResponse.data).toMatchObject({
        success: true,
        action: 'upsert',
        override: {
          user_id: 'salesperson-user',
          module_key: 'leads',
          override_mode: 'replace',
          record_scope: 'own',
          can_view: true,
          can_create: false,
          status: 'active',
          reason: 'Phase 6 targeted emulator validation.',
          last_modified_by_user_id: 'admin-user',
        },
      });

      const overrideId =
        upsertResponse.data.override.id;

      expect(overrideId).toEqual(
        expect.any(String)
      );

      const effectiveResponse =
        await client.getEffectivePermissions({
          target_user_id: 'salesperson-user',
        });

      expect(
        effectiveResponse.data.permissions.leads
      ).toMatchObject({
        module_key: 'leads',
        record_scope: 'own',
        can_view: true,
        can_create: false,
        can_edit: false,
      });

      const storedOverrides =
        await matchingOverrides(
          client.firestore,
          'salesperson-user'
        );

      expect(storedOverrides.size).toBe(1);
      expect(storedOverrides.docs[0].id).toBe(
        overrideId
      );
      expect(storedOverrides.docs[0].data()).toMatchObject({
        user_id: 'salesperson-user',
        module_key: 'leads',
        status: 'active',
        created_by_user_id: 'admin-user',
        last_modified_by_user_id: 'admin-user',
      });

      const upsertAudits = await matchingAudits(
        client.firestore,
        overrideId,
        'permission_override_upsert'
      );

      expect(upsertAudits.size).toBeGreaterThan(0);
      expect(
        upsertAudits.docs.at(-1).data()
      ).toMatchObject({
        actor_user_id: 'admin-user',
        target_user_id: 'salesperson-user',
        module_key: 'leads',
        override_id: overrideId,
      });

      const deactivateResponse =
        await client.updateUserPermissionOverride({
          action: 'deactivate',
          target_user_id: 'salesperson-user',
          module_key: 'leads',
          reason: 'Phase 6 targeted deactivation validation.',
        });

      expect(deactivateResponse.data).toMatchObject({
        success: true,
        action: 'deactivate',
        override: {
          id: overrideId,
          user_id: 'salesperson-user',
          module_key: 'leads',
          status: 'inactive',
          deactivated_by_user_id: 'admin-user',
        },
      });

      const deactivatedOverrides =
        await matchingOverrides(
          client.firestore,
          'salesperson-user'
        );

      expect(deactivatedOverrides.size).toBe(1);
      expect(
        deactivatedOverrides.docs[0].data()
      ).toMatchObject({
        status: 'inactive',
        deactivated_by_user_id: 'admin-user',
      });

      const deactivateAudits = await matchingAudits(
        client.firestore,
        overrideId,
        'permission_override_deactivate'
      );

      expect(
        deactivateAudits.size
      ).toBeGreaterThan(0);
    });

    it('allows the Super Administrator to manage an administrator-tier target', async () => {
      const client = await createClient(
        'superadmin@example.test'
      );

      const response =
        await client.updateUserPermissionOverride({
          ...upsertPayload('admin-user'),
          override_mode: 'replace',
          record_scope: 'all',
          can_create: true,
          can_edit: true,
          can_assign: true,
          reason: 'Super Administrator authority validation.',
        });

      expect(response.data).toMatchObject({
        success: true,
        action: 'upsert',
        override: {
          user_id: 'admin-user',
          module_key: 'leads',
          override_mode: 'replace',
          record_scope: 'all',
          status: 'active',
          last_modified_by_user_id: 'super-admin-user',
        },
      });

      const overrideId = response.data.override.id;

      const storedOverrides =
        await matchingOverrides(
          client.firestore,
          'admin-user'
        );

      expect(storedOverrides.size).toBe(1);
      expect(storedOverrides.docs[0].id).toBe(
        overrideId
      );

      const deactivateResponse =
        await client.updateUserPermissionOverride({
          action: 'deactivate',
          target_user_id: 'admin-user',
          module_key: 'leads',
          reason: 'Restore administrator test baseline.',
        });

      expect(deactivateResponse.data).toMatchObject({
        success: true,
        action: 'deactivate',
        override: {
          id: overrideId,
          status: 'inactive',
          deactivated_by_user_id: 'super-admin-user',
        },
      });
    });
  }
);