// tests/functions.reassignRecord.emulator.test.js
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

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
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';
const PASSWORD = 'AtlasTest!2026';

const RECORD_ID = 'phase8-reassignment-lead';
const SECOND_RECORD_ID = 'phase8-reassignment-second-lead';

const TEAM_ALPHA = 'team-alpha';
const TEAM_SUPPORT = 'team-support';

const OPERATION_PREFIX = 'phase8-reassign-operation-';

const ADMIN_PERMISSION_ID =
  'phase8-administrator-leads-permission';
const SUPERVISOR_PERMISSION_ID =
  'phase8-supervisor-leads-permission';

vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000,
});

let testEnvironment;
let clientNumber = 0;

const testApps = [];

function entityPath(entityName, recordId) {
  return [
    'entities',
    entityName,
    'records',
    recordId,
  ];
}

function auditId(operationId) {
  return `ownership-transfer-${operationId}`;
}

async function writeEntity(entityName, recordId, data) {
  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          ...entityPath(entityName, recordId)
        ),
        data
      );
    }
  );
}

async function readEntity(entityName, recordId) {
  let snapshot;

  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      snapshot = await getDoc(
        doc(
          context.firestore(),
          ...entityPath(entityName, recordId)
        )
      );
    }
  );

  return snapshot;
}

async function deleteEntity(entityName, recordId) {
  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      await deleteDoc(
        doc(
          context.firestore(),
          ...entityPath(entityName, recordId)
        )
      );
    }
  );
}

async function seedModulePermissionFixtures() {
  await Promise.all([
    writeEntity(
      'ModulePermission',
      ADMIN_PERMISSION_ID,
      {
        role_id: 'administrator',
        role_key: 'administrator',
        module_key: 'leads',
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
        can_assign: true,
        can_export: true,
        record_scope: 'all',
        field_restrictions: [],
        active: true,
      }
    ),
    writeEntity(
      'ModulePermission',
      SUPERVISOR_PERMISSION_ID,
      {
        role_id: 'supervisor',
        role_key: 'supervisor',
        module_key: 'leads',
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: false,
        can_assign: true,
        can_export: true,
        record_scope: 'team',
        field_restrictions: [],
        active: true,
      }
    ),
  ]);
}

async function seedTeamFixtures() {
  await Promise.all([
    writeEntity('Team', TEAM_ALPHA, {
      name: 'Phase 8 Alpha Team',
      manager_user_id: 'supervisor-user',
      active: true,
    }),
    writeEntity('Team', TEAM_SUPPORT, {
      name: 'Phase 8 Support Team',
      manager_user_id: 'viewer-support-user',
      active: true,
    }),
  ]);
}

async function seedLeadFixture(overrides = {}) {
  await writeEntity(
    'Lead',
    RECORD_ID,
    {
      full_name: 'Phase 8 Reassignment Lead',
      email: 'phase8-reassignment@example.test',
      lead_status: 'Qualified',
      owner_user_id: 'salesperson-user',
      assigned_team_id: TEAM_ALPHA,
      assigned_supervisor_user_id: 'supervisor-user',
      territory_id: 'territory-alpha',
      ownership_status: 'assigned',
      ownerId: 'legacy-owner',
      teamId: 'legacy-team',
      supervisorId: 'legacy-supervisor',
      territoryId: 'legacy-territory',
      ...overrides,
    }
  );
}

async function removeFixtures() {
  const operationIds = [
    `${OPERATION_PREFIX}admin`,
    `${OPERATION_PREFIX}anonymous`,
    `${OPERATION_PREFIX}inactive`,
    `${OPERATION_PREFIX}viewer`,
    `${OPERATION_PREFIX}unsupported`,
    `${OPERATION_PREFIX}source-scope`,
    `${OPERATION_PREFIX}destination-scope`,
    `${OPERATION_PREFIX}idempotent`,
    `${OPERATION_PREFIX}collision`,
  ];

  await Promise.all([
    deleteEntity('Lead', RECORD_ID),
    deleteEntity('Lead', SECOND_RECORD_ID),
    deleteEntity(
      'ModulePermission',
      ADMIN_PERMISSION_ID
    ),
    deleteEntity(
      'ModulePermission',
      SUPERVISOR_PERMISSION_ID
    ),
    ...operationIds.map((operationId) =>
      deleteEntity('AuditLog', auditId(operationId))
    ),
  ]);
}

function payload(operationId, overrides = {}) {
  return {
    entity_type: 'lead',
    entity_id: RECORD_ID,
    to_owner_user_id: 'supervisor-user',
    to_team_id: TEAM_ALPHA,
    to_supervisor_user_id: 'supervisor-user',
    transfer_operation_id: operationId,
    transfer_reason: 'Focused Phase 8 emulator test',
    transfer_type: 'manual',
    ...overrides,
  };
}

async function createCallable(email = null) {
  clientNumber += 1;

  const app = initializeApp(
    {
      apiKey: 'phase8-reassignment-test-key',
      projectId: PROJECT_ID,
    },
    `phase8-reassignment-${clientNumber}`
  );

  testApps.push(app);

  const auth = getAuth(app);
  const functions = getFunctions(app, 'us-central1');

  connectAuthEmulator(
    auth,
    'http://127.0.0.1:9099',
    {disableWarnings: true}
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

  return httpsCallable(functions, 'reassignRecord');
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await removeFixtures();
  await seedModulePermissionFixtures();
  await seedTeamFixtures();
  await seedLeadFixture();
});

afterEach(async () => {
  const apps = testApps.splice(0);

  await Promise.all(
    apps.map((app) => deleteApp(app))
  );

  await removeFixtures();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe.sequential(
  'reassignRecord Firebase callable',
  () => {
    it('denies anonymous callers', async () => {
      const reassign = await createCallable();

      await expect(
        reassign(
          payload(`${OPERATION_PREFIX}anonymous`)
        )
      ).rejects.toMatchObject({
        code: 'functions/unauthenticated',
      });
    });

    it('denies inactive callers', async () => {
      const reassign = await createCallable(
        'inactive@example.test'
      );

      await expect(
        reassign(
          payload(`${OPERATION_PREFIX}inactive`)
        )
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('denies viewer-support assignment access', async () => {
      const reassign = await createCallable(
        'viewer@example.test'
      );

      await expect(
        reassign(
          payload(`${OPERATION_PREFIX}viewer`)
        )
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('rejects unsupported entity types', async () => {
      const reassign = await createCallable(
        'admin@example.test'
      );

      await expect(
        reassign(
          payload(
            `${OPERATION_PREFIX}unsupported`,
            {entity_type: 'auditlog'}
          )
        )
      ).rejects.toMatchObject({
        code: 'functions/invalid-argument',
      });
    });

    it(
      'denies a supervisor access to an out-of-scope source record',
      async () => {
        await seedLeadFixture({
          owner_user_id: 'viewer-support-user',
          assigned_team_id: TEAM_SUPPORT,
          assigned_supervisor_user_id: null,
          territory_id: 'territory-support',
        });

        const reassign = await createCallable(
          'supervisor@example.test'
        );

        await expect(
          reassign(
            payload(`${OPERATION_PREFIX}source-scope`)
          )
        ).rejects.toMatchObject({
          code: 'functions/permission-denied',
        });

        const lead = await readEntity('Lead', RECORD_ID);

        expect(lead.data()).toMatchObject({
          owner_user_id: 'viewer-support-user',
          assigned_team_id: TEAM_SUPPORT,
        });
      }
    );

    it(
      'denies a supervisor transfer outside the actor team',
      async () => {
        const reassign = await createCallable(
          'supervisor@example.test'
        );

        await expect(
          reassign(
            payload(
              `${OPERATION_PREFIX}destination-scope`,
              {
                to_owner_user_id:
                  'viewer-support-user',
                to_team_id: TEAM_SUPPORT,
                to_supervisor_user_id: null,
              }
            )
          )
        ).rejects.toMatchObject({
          code: 'functions/permission-denied',
        });

        const lead = await readEntity('Lead', RECORD_ID);

        expect(lead.data()).toMatchObject({
          owner_user_id: 'salesperson-user',
          assigned_team_id: TEAM_ALPHA,
        });
      }
    );

    it(
      'atomically reassigns a record and creates an audit entry',
      async () => {
        const operationId = `${OPERATION_PREFIX}admin`;
        const reassign = await createCallable(
          'admin@example.test'
        );

        const response = await reassign(
          payload(operationId)
        );

        expect(response.data).toMatchObject({
          success: true,
          status: 'completed',
          entity_type: 'lead',
          entity_id: RECORD_ID,
          transfer_operation_id: operationId,
          ownership: {
            owner_user_id: 'supervisor-user',
            assigned_team_id: TEAM_ALPHA,
            assigned_supervisor_user_id:
              'supervisor-user',
            territory_id: 'territory-alpha',
            ownership_status: 'assigned',
          },
        });

        const lead = await readEntity('Lead', RECORD_ID);
        const audit = await readEntity(
          'AuditLog',
          auditId(operationId)
        );

        expect(lead.exists()).toBe(true);
        expect(audit.exists()).toBe(true);

        expect(lead.data()).toMatchObject({
          owner_user_id: 'supervisor-user',
          assigned_team_id: TEAM_ALPHA,
          assigned_supervisor_user_id:
            'supervisor-user',
          territory_id: 'territory-alpha',
          ownership_status: 'assigned',
          assigned_by_user_id: 'admin-user',
          last_modified_by_user_id: 'admin-user',
        });

        expect(lead.data()).not.toHaveProperty('ownerId');
        expect(lead.data()).not.toHaveProperty('teamId');
        expect(lead.data()).not.toHaveProperty(
          'supervisorId'
        );
        expect(lead.data()).not.toHaveProperty(
          'territoryId'
        );

        expect(audit.data()).toMatchObject({
          action_type: 'record_reassigned',
          actor_user_id: 'admin-user',
          actor_email: 'admin@example.test',
          entity_type: 'lead',
          entity_collection: 'Lead',
          entity_id: RECORD_ID,
          transfer_operation_id: operationId,
          transfer_type: 'manual',
          transfer_reason:
            'Focused Phase 8 emulator test',
          immutable: true,
          previous_value: {
            owner_user_id: 'salesperson-user',
            assigned_team_id: TEAM_ALPHA,
            assigned_supervisor_user_id:
              'supervisor-user',
            territory_id: 'territory-alpha',
            ownership_status: 'assigned',
          },
          new_value: {
            owner_user_id: 'supervisor-user',
            assigned_team_id: TEAM_ALPHA,
            assigned_supervisor_user_id:
              'supervisor-user',
            territory_id: 'territory-alpha',
            ownership_status: 'assigned',
          },
        });
      }
    );

    it(
      'returns already_processed for an idempotent replay',
      async () => {
        const operationId =
          `${OPERATION_PREFIX}idempotent`;

        const reassign = await createCallable(
          'admin@example.test'
        );

        const first = await reassign(
          payload(operationId)
        );

        const second = await reassign(
          payload(operationId)
        );

        expect(first.data).toMatchObject({
          success: true,
          status: 'completed',
          transfer_operation_id: operationId,
        });

        expect(second.data).toMatchObject({
          success: true,
          status: 'already_processed',
          entity_type: 'lead',
          entity_id: RECORD_ID,
          transfer_operation_id: operationId,
        });

        const audit = await readEntity(
          'AuditLog',
          auditId(operationId)
        );

        expect(audit.exists()).toBe(true);
        expect(audit.data()).toMatchObject({
          entity_type: 'lead',
          entity_id: RECORD_ID,
          transfer_operation_id: operationId,
        });
      }
    );

    it(
      'rejects reuse of an operation identifier for another record',
      async () => {
        const operationId =
          `${OPERATION_PREFIX}collision`;

        await writeEntity(
          'AuditLog',
          auditId(operationId),
          {
            action_type: 'record_reassigned',
            entity_type: 'lead',
            entity_id: SECOND_RECORD_ID,
            transfer_operation_id: operationId,
            immutable: true,
          }
        );

        const reassign = await createCallable(
          'admin@example.test'
        );

        await expect(
          reassign(payload(operationId))
        ).rejects.toMatchObject({
          code: 'functions/already-exists',
        });

        const lead = await readEntity('Lead', RECORD_ID);

        expect(lead.data()).toMatchObject({
          owner_user_id: 'salesperson-user',
          assigned_team_id: TEAM_ALPHA,
        });
      }
    );
  }
);