// tests/functions.convertLeadToOpportunity.emulator.test.js
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
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';
const PASSWORD = 'AtlasTest!2026';

const LEAD_ID = 'phase7-conversion-lead';
const OPPORTUNITY_ID = `lead-${LEAD_ID}`;
const LEGACY_OPPORTUNITY_ID =
  'phase7-existing-opportunity';
const SECOND_OPPORTUNITY_ID =
  'phase7-second-opportunity';

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

function entityCollectionPath(entityName) {
  return [
    'entities',
    entityName,
    'records',
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

async function readOpportunitiesForLead() {
  let snapshots = [];

  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      const result = await getDocs(
        query(
          collection(
            context.firestore(),
            ...entityCollectionPath('Opportunity')
          ),
          where('lead_id', '==', LEAD_ID)
        )
      );

      snapshots = result.docs;
    }
  );

  return snapshots;
}

async function readConversionAudits() {
  let snapshots = [];

  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      const result = await getDocs(
        query(
          collection(
            context.firestore(),
            ...entityCollectionPath('AuditLog')
          ),
          where('lead_id', '==', LEAD_ID)
        )
      );

      snapshots = result.docs.filter(
        (snapshot) =>
          snapshot.data().action ===
          'lead_converted_to_opportunity'
      );
    }
  );

  return snapshots;
}

async function removeFixtures() {
  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      const database = context.firestore();

      const opportunitySnapshot = await getDocs(
        query(
          collection(
            database,
            ...entityCollectionPath('Opportunity')
          ),
          where('lead_id', '==', LEAD_ID)
        )
      );

      const auditSnapshot = await getDocs(
        query(
          collection(
            database,
            ...entityCollectionPath('AuditLog')
          ),
          where('lead_id', '==', LEAD_ID)
        )
      );

      await Promise.all([
        deleteDoc(
          doc(
            database,
            ...entityPath('Lead', LEAD_ID)
          )
        ),
        deleteDoc(
          doc(
            database,
            ...entityPath(
              'Opportunity',
              OPPORTUNITY_ID
            )
          )
        ),
        deleteDoc(
          doc(
            database,
            ...entityPath(
              'Opportunity',
              LEGACY_OPPORTUNITY_ID
            )
          )
        ),
        deleteDoc(
          doc(
            database,
            ...entityPath(
              'Opportunity',
              SECOND_OPPORTUNITY_ID
            )
          )
        ),
        ...opportunitySnapshot.docs.map(
          (snapshot) =>
            deleteDoc(snapshot.ref)
        ),
        ...auditSnapshot.docs.map(
          (snapshot) =>
            deleteDoc(snapshot.ref)
        ),
      ]);
    }
  );
}

async function seedLeadFixture(overrides = {}) {
  await writeFixture(
    'Lead',
    LEAD_ID,
    {
      full_name: 'Phase 7 Lead',
      email: 'phase7-lead@example.test',
      phone_number: '555-0107',
      lead_status: 'Qualified',
      product_type: 'Fuel Service',
      owner_user_id: 'salesperson-user',
      assigned_team_id: 'team-alpha',
      assigned_supervisor_user_id:
        'supervisor-user',
      territory_id: 'territory-alpha',
      ownership_status: 'assigned',
      assigned_by_user_id: 'admin-user',
      assignment_date:
        '2026-07-29T00:00:00.000Z',
      last_activity_date:
        '2026-07-29T01:00:00.000Z',
      created_date:
        '2026-07-29T00:00:00.000Z',
      updated_date:
        '2026-07-29T00:00:00.000Z',
      ...overrides,
    }
  );
}

async function createCallable(email = null) {
  clientNumber += 1;

  const app = initializeApp(
    {
      apiKey: 'phase7-conversion-test-key',
      projectId: PROJECT_ID,
    },
    `phase7-conversion-${clientNumber}`
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
    'convertLeadToOpportunity'
  );
}

beforeAll(async () => {
  testEnvironment =
    await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
      },
    });
});

beforeEach(async () => {
  await removeFixtures();
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
  'convertLeadToOpportunity Firebase callable',
  () => {
    it('denies anonymous callers', async () => {
      const convert = await createCallable();

      await expect(
        convert({
          leadId: LEAD_ID,
        })
      ).rejects.toMatchObject({
        code: 'functions/unauthenticated',
      });
    });

    it('rejects unsupported payload fields', async () => {
      const convert = await createCallable(
        'admin@example.test'
      );

      await expect(
        convert({
          leadId: LEAD_ID,
          productType: 'Unauthorized override',
        })
      ).rejects.toMatchObject({
        code: 'functions/invalid-argument',
      });
    });

    it('denies inactive callers', async () => {
      const convert = await createCallable(
        'inactive@example.test'
      );

      await expect(
        convert({
          leadId: LEAD_ID,
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
          leadId: LEAD_ID,
        })
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    });

    it(
      'denies a salesperson converting another owner lead',
      async () => {
        await seedLeadFixture({
          owner_user_id: 'admin-user',
          assigned_team_id: 'team-bravo',
          assigned_supervisor_user_id:
            null,
        });

        const convert = await createCallable(
          'salesperson@example.test'
        );

        await expect(
          convert({
            leadId: LEAD_ID,
          })
        ).rejects.toMatchObject({
          code: 'functions/permission-denied',
        });
      }
    );

    it('rejects archived leads', async () => {
      await seedLeadFixture({
        is_deleted: true,
      });

      const convert = await createCallable(
        'admin@example.test'
      );

      await expect(
        convert({
          leadId: LEAD_ID,
        })
      ).rejects.toMatchObject({
        code: 'functions/failed-precondition',
      });
    });

    it(
      'allows a supervisor to convert a team lead',
      async () => {
        const convert = await createCallable(
          'supervisor@example.test'
        );

        const response = await convert({
          leadId: LEAD_ID,
        });

        expect(response.data).toMatchObject({
          success: true,
          opportunityId: OPPORTUNITY_ID,
          created: true,
        });
      }
    );

    it(
      'converts an owned lead atomically',
      async () => {
        const convert = await createCallable(
          'salesperson@example.test'
        );

        const response = await convert({
          leadId: LEAD_ID,
        });

        expect(response.data).toMatchObject({
          success: true,
          opportunityId: OPPORTUNITY_ID,
          created: true,
        });

        const [
          lead,
          opportunity,
          audits,
        ] = await Promise.all([
          readFixture('Lead', LEAD_ID),
          readFixture(
            'Opportunity',
            OPPORTUNITY_ID
          ),
          readConversionAudits(),
        ]);

        expect(lead.data()).toMatchObject({
          lead_status: 'Converted',
          converted_opportunity_id:
            OPPORTUNITY_ID,
          last_modified_by_user_id:
            'salesperson-user',
        });

        expect(opportunity.data()).toMatchObject({
          lead_id: LEAD_ID,
          lead_name: 'Phase 7 Lead',
          product_type: 'Fuel Service',
          deal_stage: 'New (חדש)',
          probability: 10,
          owner_user_id: 'salesperson-user',
          assigned_team_id: 'team-alpha',
          assigned_supervisor_user_id:
            'supervisor-user',
          territory_id: 'territory-alpha',
          created_by_user_id:
            'salesperson-user',
        });

        expect(audits).toHaveLength(1);

        expect(audits[0].data()).toMatchObject({
          action:
            'lead_converted_to_opportunity',
          actor_user_id: 'salesperson-user',
          lead_id: LEAD_ID,
          opportunity_id: OPPORTUNITY_ID,
        });
      }
    );

    it(
      'is idempotent when called twice',
      async () => {
        const convert = await createCallable(
          'admin@example.test'
        );

        const first = await convert({
          leadId: LEAD_ID,
        });

        const second = await convert({
          leadId: LEAD_ID,
        });

        expect(first.data).toMatchObject({
          success: true,
          opportunityId: OPPORTUNITY_ID,
          created: true,
        });

        expect(second.data).toMatchObject({
          success: true,
          opportunityId: OPPORTUNITY_ID,
          created: false,
        });

        const opportunities =
          await readOpportunitiesForLead();

        expect(opportunities).toHaveLength(1);
      }
    );

    it(
      'reuses an existing opportunity for the lead',
      async () => {
        await writeFixture(
          'Opportunity',
          LEGACY_OPPORTUNITY_ID,
          {
            lead_id: LEAD_ID,
            lead_name: 'Phase 7 Lead',
            deal_stage: 'New (חדש)',
            owner_user_id: 'salesperson-user',
            assigned_team_id: 'team-alpha',
          }
        );

        const convert = await createCallable(
          'admin@example.test'
        );

        const response = await convert({
          leadId: LEAD_ID,
        });

        expect(response.data).toMatchObject({
          success: true,
          opportunityId:
            LEGACY_OPPORTUNITY_ID,
          created: false,
        });

        const [
          lead,
          deterministicOpportunity,
          opportunities,
        ] = await Promise.all([
          readFixture('Lead', LEAD_ID),
          readFixture(
            'Opportunity',
            OPPORTUNITY_ID
          ),
          readOpportunitiesForLead(),
        ]);

        expect(
          lead.data().converted_opportunity_id
        ).toBe(LEGACY_OPPORTUNITY_ID);

        expect(
          deterministicOpportunity.exists()
        ).toBe(false);

        expect(opportunities).toHaveLength(1);
      }
    );

    it(
      'rejects multiple existing opportunities',
      async () => {
        await Promise.all([
          writeFixture(
            'Opportunity',
            LEGACY_OPPORTUNITY_ID,
            {
              lead_id: LEAD_ID,
              deal_stage: 'New (חדש)',
            }
          ),
          writeFixture(
            'Opportunity',
            SECOND_OPPORTUNITY_ID,
            {
              lead_id: LEAD_ID,
              deal_stage: 'Qualified',
            }
          ),
        ]);

        const convert = await createCallable(
          'admin@example.test'
        );

        await expect(
          convert({
            leadId: LEAD_ID,
          })
        ).rejects.toMatchObject({
          code: 'functions/failed-precondition',
        });
      }
    );
  }
);