// tests/functions.automationTrigger.emulator.test.js
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
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

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';

vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000,
});

let testEnvironment;

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

async function withAdmin(callback) {
  let result;

  await testEnvironment.withSecurityRulesDisabled(
    async (context) => {
      result = await callback(context.firestore());
    }
  );

  return result;
}

async function writeFixture(
  entityName,
  recordId,
  data
) {
  await withAdmin(
    (database) => setDoc(
      doc(
        database,
        ...entityPath(entityName, recordId)
      ),
      data
    )
  );
}

async function updateFixture(
  entityName,
  recordId,
  data
) {
  await withAdmin(
    (database) => updateDoc(
      doc(
        database,
        ...entityPath(entityName, recordId)
      ),
      data
    )
  );
}

async function readFixture(
  entityName,
  recordId
) {
  return withAdmin(
    (database) => getDoc(
      doc(
        database,
        ...entityPath(entityName, recordId)
      )
    )
  );
}

async function listFixtures(entityName) {
  return withAdmin(
    (database) => getDocs(
      collection(
        database,
        ...entityCollectionPath(entityName)
      )
    )
  );
}

async function clearEntity(entityName) {
  await withAdmin(async (database) => {
    const snapshot = await getDocs(
      collection(
        database,
        ...entityCollectionPath(entityName)
      )
    );

    await Promise.all(
      snapshot.docs.map(
        (record) => deleteDoc(record.ref)
      )
    );
  });
}

async function clearFixtures() {
  for (
    const entityName of [
      'AutomationRule',
      'AutomationLog',
      'Task',
      'Lead',
      'Opportunity',
    ]
  ) {
    await clearEntity(entityName);
  }
}

async function waitFor(
  callback,
  message,
  timeout = 12000
) {
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const result = await callback();

    if (result) {
      return result;
    }

    await new Promise(
      (resolve) => setTimeout(resolve, 125)
    );
  }

  throw new Error(message);
}

async function waitForLogs(count = 1) {
  return waitFor(
    async () => {
      const snapshot =
        await listFixtures('AutomationLog');

      return snapshot.size >= count ?
        snapshot :
        null;
    },
    `Timed out waiting for ${count} automation log(s).`
  );
}

async function waitForTasks(count = 1) {
  return waitFor(
    async () => {
      const snapshot = await listFixtures('Task');

      return snapshot.size >= count ?
        snapshot :
        null;
    },
    `Timed out waiting for ${count} automation task(s).`
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

afterEach(async () => {
  await clearFixtures();
});

afterAll(async () => {
  await clearFixtures();
  await testEnvironment.cleanup();
});

describe.sequential(
  'server-controlled automation Firestore trigger',
  () => {
    it(
      'creates one task and success log for a create rule',
      async () => {
        await writeFixture(
          'AutomationRule',
          'create-lead-task',
          {
            name: 'Welcome new lead',
            trigger_entity: 'Lead',
            trigger_event: 'create',
            condition_field: 'lead_status',
            condition_operator: 'equals',
            condition_value: 'New',
            action_type: 'create_task',
            action_config: {
              task_title:
                'Contact {{full_name}}',
              task_description:
                'Call {{phone_number}}',
              task_due_days: 2,
            },
            is_active: true,
          }
        );

        await writeFixture(
          'Lead',
          'automation-create-lead',
          {
            full_name: 'Automation Lead',
            phone_number: '555-0188',
            lead_status: 'New',
            owner_user_id: 'salesperson-user',
            assigned_team_id: 'team-alpha',
          }
        );

        const [tasks, logs] =
          await Promise.all([
            waitForTasks(),
            waitForLogs(),
          ]);

        expect(tasks.size).toBe(1);
        expect(logs.size).toBe(1);

        expect(tasks.docs[0].data()).toMatchObject({
          title: 'Contact Automation Lead',
          description: 'Call 555-0188',
          status: 'todo',
          related_lead_id:
            'automation-create-lead',
          owner_user_id: 'salesperson-user',
          assigned_team_id: 'team-alpha',
          automation_rule_id:
            'create-lead-task',
        });

        expect(logs.docs[0].data()).toMatchObject({
          rule_id: 'create-lead-task',
          entity_type: 'Lead',
          entity_id: 'automation-create-lead',
          trigger_event: 'create',
          status: 'success',
        });
      }
    );

    it(
      'does not execute when the condition is unmet',
      async () => {
        await writeFixture(
          'AutomationRule',
          'unmet-condition',
          {
            name: 'Qualified lead task',
            trigger_entity: 'Lead',
            trigger_event: 'create',
            condition_field: 'lead_status',
            condition_operator: 'equals',
            condition_value: 'Qualified',
            action_type: 'create_task',
            action_config: {
              task_title: 'Qualified lead',
            },
            is_active: true,
          }
        );

        await writeFixture(
          'Lead',
          'automation-unmet-lead',
          {
            full_name: 'Unmet Lead',
            lead_status: 'New',
          }
        );

        await new Promise(
          (resolve) => setTimeout(resolve, 1250)
        );

        const [tasks, logs] =
          await Promise.all([
            listFixtures('Task'),
            listFixtures('AutomationLog'),
          ]);

        expect(tasks.size).toBe(0);
        expect(logs.size).toBe(0);
      }
    );

    it(
      'uses trusted before and after data for transitions',
      async () => {
        await writeFixture(
          'AutomationRule',
          'qualified-transition',
          {
            name: 'Qualified transition',
            trigger_entity: 'Lead',
            trigger_event: 'update',
            condition_field: 'lead_status',
            condition_operator: 'equals',
            condition_value: 'Qualified',
            action_type: 'create_task',
            action_config: {
              task_title:
                'Prepare proposal for {{full_name}}',
              task_due_days: 1,
            },
            is_active: true,
          }
        );

        await writeFixture(
          'Lead',
          'automation-update-lead',
          {
            full_name: 'Transition Lead',
            lead_status: 'New',
          }
        );

        await updateFixture(
          'Lead',
          'automation-update-lead',
          {
            lead_status: 'Qualified',
          }
        );

        const [tasks, logs] =
          await Promise.all([
            waitForTasks(),
            waitForLogs(),
          ]);

        expect(tasks.size).toBe(1);
        expect(logs.size).toBe(1);

        expect(tasks.docs[0].data().title)
          .toBe(
            'Prepare proposal for Transition Lead'
          );

        await updateFixture(
          'Lead',
          'automation-update-lead',
          {
            updated_date:
              '2026-08-04T12:00:00.000Z',
          }
        );

        await new Promise(
          (resolve) => setTimeout(resolve, 750)
        );

        expect(
          (await listFixtures('Task')).size
        ).toBe(1);
      }
    );

    it(
      'routes email actions through safe-disabled delivery',
      async () => {
        await writeFixture(
          'AutomationRule',
          'server-email-delivery',
          {
            name: 'Server email delivery',
            trigger_entity: 'Lead',
            trigger_event: 'create',
            action_type: 'send_email',
            action_config: {
              email_to: '{{email}}',
              email_subject: 'Welcome {{full_name}}',
              email_body: 'Your CRM record is ready.',
            },
            is_active: true,
          }
        );

        await writeFixture(
          'Lead',
          'automation-email-lead',
          {
            full_name: 'Email Lead',
            email: 'lead@example.test',
            lead_status: 'New',
          }
        );

        const logs = await waitForLogs();

        expect(logs.size).toBe(1);
        expect(logs.docs[0].data()).toMatchObject({
          rule_id: 'server-email-delivery',
          entity_type: 'Lead',
          entity_id: 'automation-email-lead',
          status: 'skipped',
          error_message: 'provider_not_configured',
          action_taken:
            'send_email: server-controlled delivery',
        });
        expect(
          logs.docs[0].data().action_taken
        ).not.toContain('lead@example.test');
        expect((await listFixtures('Task')).size)
          .toBe(0);
      }
    );

    it(
      'fails closed for unrestricted entity updates',
      async () => {
        await writeFixture(
          'AutomationRule',
          'blocked-entity-update',
          {
            name: 'Unsafe entity update',
            trigger_entity: 'Opportunity',
            trigger_event: 'create',
            action_type: 'update_entity',
            action_config: {
              update_field: 'owner_user_id',
              update_value: 'attacker-user',
            },
            is_active: true,
          }
        );

        await writeFixture(
          'Opportunity',
          'automation-opportunity',
          {
            lead_name: 'Protected Opportunity',
            deal_stage: 'New',
            owner_user_id: 'salesperson-user',
          }
        );

        const logs = await waitForLogs();
        const opportunity = await readFixture(
          'Opportunity',
          'automation-opportunity'
        );

        expect(logs.size).toBe(1);

        expect(logs.docs[0].data()).toMatchObject({
          rule_id: 'blocked-entity-update',
          entity_type: 'Opportunity',
          status: 'failed',
        });

        expect(logs.docs[0].data().error_message)
          .toContain('field allowlist');

        expect(opportunity.data().owner_user_id)
          .toBe('salesperson-user');

        expect(
          (await listFixtures('Task')).size
        ).toBe(0);
      }
    );
  }
);