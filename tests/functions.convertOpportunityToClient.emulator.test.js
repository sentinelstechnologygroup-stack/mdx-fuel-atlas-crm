// tests/functions.convertOpportunityToClient.emulator.test.js
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
const OPPORTUNITY_ID = 'phase6-conversion-opportunity';
const LEAD_ID = 'phase6-conversion-lead';

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

async function writeFixture(
  entityName,
  recordId,
  data
) {
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

async function readFixture(entityName, recordId) {
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

async function removeFixtures() {
  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      const database = context.firestore();

      await Promise.all([
        ['Opportunity', OPPORTUNITY_ID],
        ['Lead', LEAD_ID],
        ['Client', OPPORTUNITY_ID],
        ['Task', OPPORTUNITY_ID],
      ].map(
        ([entityName, recordId]) => deleteDoc(
          doc(
            database,
            ...entityPath(entityName, recordId)
          )
        ).catch(() => undefined)
      ));
    }
  );
}

async function seedConversionFixture(
  overrides = {}
) {
  await writeFixture(
    'Lead',
    LEAD_ID,
    {
      full_name: 'Phase 6 Client',
      email: 'client@example.test',
      phone_number: '555-0106',
      lead_status: 'Qualified',
      documents: [
        {
          name: 'Lead document',
          url: 'https://example.test/document',
        },
      ],
    }
  );

  await writeFixture(
    'Opportunity',
    OPPORTUNITY_ID,
    {
      lead_id: LEAD_ID,
      lead_name: 'Phase 6 Client',
      deal_stage: 'Closed Won',
      amount: 25000,
      product_type: 'Fuel Service',
      owner_user_id: 'salesperson-user',
      assigned_team_id: 'team-alpha',
      assigned_supervisor_user_id:
        'supervisor-user',
      territory_id: 'territory-alpha',
      documents: [
        {
          name: 'Duplicate document',
          url: 'https://example.test/document',
        },
      ],
      ...overrides,
    }
  );
}

async function createCallable(email = null) {
  clientNumber += 1;

  const app = initializeApp(
    {
      apiKey: 'phase6-conversion-test-key',
      projectId: PROJECT_ID,
    },
    'phase6-conversion-' + clientNumber
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
    'convertOpportunityToClient'
  );
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
  await seedConversionFixture();
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
  'convertOpportunityToClient Firebase callable',
  () => {
    it('denies anonymous callers', async () => {
      const convert = await createCallable();

      await expect(
        convert({
          opportunityId: OPPORTUNITY_ID,
        })
      ).rejects.toMatchObject({
        code: 'functions/unauthenticated',
      });
    });

    it('denies inactive callers', async () => {
      const convert = await createCallable(
        'inactive@example.test'
      );

      await expect(
        convert({
          opportunityId: OPPORTUNITY_ID,
        })
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('denies read-only callers', async () => {
      const convert = await createCallable(
        'viewer@example.test'
      );

      await expect(
        convert({
          opportunityId: OPPORTUNITY_ID,
        })
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('denies access to another owner record', async () => {
      await writeFixture(
        'Opportunity',
        OPPORTUNITY_ID,
        {
          lead_id: LEAD_ID,
          deal_stage: 'Closed Won',
          owner_user_id: 'admin-user',
          assigned_team_id: 'team-bravo',
        }
      );

      const convert = await createCallable(
        'salesperson@example.test'
      );

      await expect(
        convert({
          opportunityId: OPPORTUNITY_ID,
        })
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it('requires a Closed Won opportunity', async () => {
      await seedConversionFixture({
        deal_stage: 'Proposal',
      });

      const convert = await createCallable(
        'admin@example.test'
      );

      await expect(
        convert({
          opportunityId: OPPORTUNITY_ID,
        })
      ).rejects.toMatchObject({
        code: 'functions/failed-precondition',
      });
    });

    it('requires the related lead', async () => {
      await testEnvironment.withSecurityRulesDisabled(
        async (context) => {
          await deleteDoc(
            doc(
              context.firestore(),
              ...entityPath('Lead', LEAD_ID)
            )
          );
        }
      );

      const convert = await createCallable(
        'admin@example.test'
      );

      await expect(
        convert({
          opportunityId: OPPORTUNITY_ID,
        })
      ).rejects.toMatchObject({
        code: 'functions/not-found',
      });
    });

    it('converts an owned opportunity atomically', async () => {
      const convert = await createCallable(
        'salesperson@example.test'
      );

      const response = await convert({
        opportunityId: OPPORTUNITY_ID,
      });

      expect(response.data).toMatchObject({
        success: true,
        clientId: OPPORTUNITY_ID,
        created: true,
      });

      const [
        opportunity,
        lead,
        client,
        task,
      ] = await Promise.all([
        readFixture('Opportunity', OPPORTUNITY_ID),
        readFixture('Lead', LEAD_ID),
        readFixture('Client', OPPORTUNITY_ID),
        readFixture('Task', OPPORTUNITY_ID),
      ]);

      expect(opportunity.data().client_id)
        .toBe(OPPORTUNITY_ID);
      expect(lead.data().lead_status)
        .toBe('Converted');
      expect(client.data()).toMatchObject({
        crm_lead_id: LEAD_ID,
        crm_opportunity_id: OPPORTUNITY_ID,
        full_name: 'Phase 6 Client',
        onboarding_status: 'Not Started',
        owner_user_id: 'salesperson-user',
      });
      expect(client.data().documents).toHaveLength(1);
      expect(task.data()).toMatchObject({
        related_client_id: OPPORTUNITY_ID,
        status: 'todo',
        priority: 'high',
      });
    });

    it('is idempotent when called twice', async () => {
      const convert = await createCallable(
        'admin@example.test'
      );

      const first = await convert({
        opportunityId: OPPORTUNITY_ID,
      });
      const second = await convert({
        opportunityId: OPPORTUNITY_ID,
      });

      expect(first.data.created).toBe(true);
      expect(second.data).toMatchObject({
        success: true,
        clientId: OPPORTUNITY_ID,
        created: false,
      });

      const client =
        await readFixture('Client', OPPORTUNITY_ID);
      const task =
        await readFixture('Task', OPPORTUNITY_ID);

      expect(client.exists()).toBe(true);
      expect(task.exists()).toBe(true);
    });
  }
);
