import {createRequire} from 'node:module';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const requireFromFunctions = createRequire(
  new URL('../functions/package.json', import.meta.url)
);
const {
  getApps,
  initializeApp,
} = requireFromFunctions('firebase-admin/app');
const {
  getFirestore,
} = requireFromFunctions('firebase-admin/firestore');

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'mdx-fuel-atlas-crm-dev';

if (getApps().length === 0) {
  initializeApp({projectId: PROJECT_ID});
}

const firestore = getFirestore();
const RUN_ID =
  `phase8-reminders-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
const RUN_DATE = '2026-08-04';
const CREATED_DATE = '2026-08-04T13:00:00.000Z';
const references = [];

let processDailyReminderNotifications;
let firstCreatedCount;
let secondCreatedCount;
let notifications;

function track(reference) {
  references.push(reference);
  return reference;
}

function profileId(label) {
  return `${RUN_ID}-${label}`;
}

function email(label) {
  return `${RUN_ID}-${label}@example.test`;
}

async function setProfile(label, values = {}) {
  const reference = track(
    firestore.collection('userProfiles').doc(profileId(label))
  );

  await reference.set({
    email: email(label),
    application_role: 'salesperson',
    account_status: 'active',
    ...values,
  });

  return {
    id: reference.id,
    email: email(label),
  };
}

async function setSettings(label, user, values = {}) {
  const reference = track(
    firestore
      .collection('entities/NotificationSettings/records')
      .doc(`${RUN_ID}-settings-${label}`)
  );

  await reference.set({
    user_id: user.id,
    user_email: user.email,
    notify_tasks: true,
    notify_opp_closing: true,
    days_before_deadline: 3,
    ...values,
  });
}

async function setEntity(entityName, label, values) {
  const reference = track(
    firestore
      .collection(`entities/${entityName}/records`)
      .doc(`${RUN_ID}-${label}`)
  );

  await reference.set(values);
  return reference.id;
}

beforeAll(async () => {
  ({
    processDailyReminderNotifications,
  } = await import('../functions/lib/notifications.js'));

  const owner = await setProfile('owner');
  const muted = await setProfile('muted');
  const inactive = await setProfile('inactive', {
    account_status: 'inactive',
  });

  await setSettings('owner', owner);
  await setSettings('muted', muted, {
    notify_tasks: false,
    notify_opp_closing: false,
  });

  await setEntity('Task', 'due-today', {
    title: 'Call customer',
    due_date: RUN_DATE,
    status: 'todo',
    owner_user_id: owner.id,
  });

  await setEntity('Task', 'overdue', {
    title: 'Review delivery plan',
    due_date: '2026-08-02',
    status: 'in_progress',
    assigned_to: owner.email,
  });

  await setEntity('Task', 'done', {
    title: 'Completed task',
    due_date: RUN_DATE,
    status: 'done',
    owner_user_id: owner.id,
  });

  await setEntity('Task', 'muted-task', {
    title: 'Muted task',
    due_date: RUN_DATE,
    status: 'todo',
    owner_user_id: muted.id,
  });

  await setEntity('Task', 'inactive-task', {
    title: 'Inactive user task',
    due_date: RUN_DATE,
    status: 'todo',
    owner_user_id: inactive.id,
  });

  await setEntity('Opportunity', 'closing-soon', {
    lead_name: 'North Houston Fleet',
    expected_close_date: '2026-08-07',
    deal_stage: 'Proposal',
    owner_user_id: owner.id,
  });

  await setEntity('Opportunity', 'closed', {
    lead_name: 'Closed opportunity',
    expected_close_date: '2026-08-05',
    deal_stage: 'Closed Won',
    owner_user_id: owner.id,
  });

  await setEntity('Opportunity', 'outside-window', {
    lead_name: 'Future opportunity',
    expected_close_date: '2026-08-08',
    deal_stage: 'New',
    owner_user_id: owner.id,
  });

  await setEntity('Opportunity', 'muted-opportunity', {
    lead_name: 'Muted opportunity',
    expected_close_date: '2026-08-05',
    deal_stage: 'Proposal',
    owner_user_id: muted.id,
  });

  firstCreatedCount =
    await processDailyReminderNotifications(
      RUN_DATE,
      CREATED_DATE
    );

  secondCreatedCount =
    await processDailyReminderNotifications(
      RUN_DATE,
      CREATED_DATE
    );

  const snapshot = await firestore
    .collection('entities/Notification/records')
    .where('notification_run_date', '==', RUN_DATE)
    .get();

  notifications = snapshot.docs
    .filter((document) =>
      document.data().related_entity_id.startsWith(RUN_ID)
    )
    .map((document) => {
      track(document.ref);

      return {
        id: document.id,
        ...document.data(),
      };
    });
}, 30000);

afterAll(async () => {
  for (const reference of references.reverse()) {
    await reference.delete().catch(() => undefined);
  }
}, 30000);

describe('Phase 8 daily reminder notifications', () => {
  it('creates due and overdue task reminders', () => {
    const taskNotifications = notifications.filter(
      (notification) => notification.type === 'task'
    );

    expect(taskNotifications).toHaveLength(2);
    expect(
      taskNotifications.map((notification) => notification.title)
    ).toEqual(
      expect.arrayContaining([
        'Task due today',
        'Task overdue',
      ])
    );
  });

  it('uses the owner deadline preference for opportunities', () => {
    const opportunityNotifications = notifications.filter(
      (notification) => notification.type === 'opportunity'
    );

    expect(opportunityNotifications).toHaveLength(1);
    expect(opportunityNotifications[0]).toMatchObject({
      title: 'Opportunity closing soon',
      related_entity_type: 'Opportunity',
      related_entity_id: `${RUN_ID}-closing-soon`,
    });
  });

  it('excludes completed, closed, and out-of-window records', () => {
    const relatedIds = notifications.map(
      (notification) => notification.related_entity_id
    );

    expect(relatedIds).not.toContain(`${RUN_ID}-done`);
    expect(relatedIds).not.toContain(`${RUN_ID}-closed`);
    expect(relatedIds).not.toContain(
      `${RUN_ID}-outside-window`
    );
  });

  it('honors disabled preferences and inactive users', () => {
    const relatedIds = notifications.map(
      (notification) => notification.related_entity_id
    );

    expect(relatedIds).not.toContain(`${RUN_ID}-muted-task`);
    expect(relatedIds).not.toContain(
      `${RUN_ID}-muted-opportunity`
    );
    expect(relatedIds).not.toContain(
      `${RUN_ID}-inactive-task`
    );
  });

  it('is deterministic and server controlled', () => {
    expect(firstCreatedCount).toBe(3);
    expect(secondCreatedCount).toBe(0);
    expect(notifications).toHaveLength(3);

    for (const notification of notifications) {
      expect(notification.server_controlled).toBe(true);
      expect(notification.is_read).toBe(false);
      expect(notification.deterministic_key)
        .toBe(notification.id);
      expect(notification.notification_source)
        .toBe('daily_reminder_processor');
      expect(notification.created_by_user_id).toBe('system');
      expect(notification.created_date).toBe(CREATED_DATE);
    }
  });
});
