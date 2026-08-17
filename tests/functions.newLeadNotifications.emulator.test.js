// tests/functions.newLeadNotifications.emulator.test.js
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import {
  createRequire,
} from 'node:module';

const functionsRequire = createRequire(
  new URL('../functions/package.json', import.meta.url)
);
const {
  deleteApp,
  getApps,
  initializeApp,
} = functionsRequire('firebase-admin/app');
const {
  getFirestore,
} = functionsRequire('firebase-admin/firestore');

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';
const RUN_ID =
  `lead-notification-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;

let firestore;
let processNewLeadNotifications;
const cleanupReferences = new Map();

function track(reference) {
  cleanupReferences.set(reference.path, reference);
  return reference;
}

function profileId(label) {
  return `${RUN_ID}-${label}`;
}

function profileEmail(label) {
  return `${RUN_ID}-${label}@example.test`;
}

async function setProfile(label, values = {}) {
  const reference = track(
    firestore.collection('userProfiles').doc(profileId(label))
  );

  await reference.set({
    uid: profileId(label),
    email: profileEmail(label),
    application_role: 'salesperson',
    account_status: 'active',
    ...values,
  });

  return {
    id: profileId(label),
    email: profileEmail(label),
    reference,
  };
}

async function setPreference(label, user, enabled) {
  const reference = track(
    firestore
      .collection('entities/NotificationSettings/records')
      .doc(`${RUN_ID}-settings-${label}`)
  );

  await reference.set({
    user_id: user.id,
    user_email: user.email,
    notify_new_leads: enabled,
  });
}

async function activeAdminRecipientIds() {
  const snapshot = await firestore
    .collection('userProfiles')
    .where('account_status', '==', 'active')
    .get();

  return snapshot.docs
    .filter((document) => {
      const role = document.data().application_role;

      return role === 'administrator' ||
        role === 'admin' ||
        role === 'super_admin';
    })
    .map((document) => document.id)
    .sort();
}

async function createRecipientFixture({
  disableOwner = false,
  disableAdministrator = false,
} = {}) {
  const supervisor = await setProfile('supervisor', {
    application_role: 'supervisor',
  });
  const owner = await setProfile('owner', {
    application_role: 'salesperson',
    supervisor_user_id: supervisor.id,
  });
  const administrator = await setProfile('administrator', {
    application_role: 'administrator',
  });
  const superAdministrator =
    await setProfile('super-administrator', {
      application_role: 'super_admin',
    });

  await setProfile('unrelated-salesperson', {
    application_role: 'salesperson',
  });
  await setProfile('viewer-support', {
    application_role: 'viewer_support',
  });
  await setProfile('inactive-administrator', {
    application_role: 'administrator',
    account_status: 'inactive',
  });
  await setProfile('suspended-super-administrator', {
    application_role: 'super_admin',
    account_status: 'suspended',
  });

  if (disableOwner) {
    await setPreference('owner', owner, false);
  }

  if (disableAdministrator) {
    await setPreference(
      'administrator',
      administrator,
      false
    );
  }

  return {
    owner,
    supervisor,
    administrator,
    superAdministrator,
  };
}

async function notificationsForLead(leadId) {
  const snapshot = await firestore
    .collection('entities/Notification/records')
    .where(
      'notification_event_id',
      '==',
      `lead-created-${leadId}`
    )
    .get();

  for (const document of snapshot.docs) {
    track(document.ref);
  }

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

async function waitForNotificationCount(
  leadId,
  expectedCount,
  timeoutMs = 20000
) {
  const deadline = Date.now() + timeoutMs;
  let notifications = [];

  while (Date.now() < deadline) {
    notifications = await notificationsForLead(leadId);

    if (notifications.length === expectedCount) {
      return notifications;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    `Expected ${expectedCount} notifications for ${leadId}, ` +
    `received ${notifications.length}.`
  );
}

async function createLead(label, data) {
  const leadId = `${RUN_ID}-${label}`;
  const reference = track(
    firestore
      .collection('entities/Lead/records')
      .doc(leadId)
  );

  await reference.create(data);

  return {
    id: leadId,
    reference,
  };
}

beforeAll(async () => {
  process.env.GCLOUD_PROJECT = PROJECT_ID;

  if (getApps().length === 0) {
    initializeApp({projectId: PROJECT_ID});
  }

  firestore = getFirestore();

  ({
    processNewLeadNotifications,
  } = await import(
    '../functions/lib/notifications.js'
  ));
});

afterEach(async () => {
  const references = [...cleanupReferences.values()]
    .sort((left, right) =>
      right.path.length - left.path.length
    );

  cleanupReferences.clear();

  for (const reference of references) {
    await reference.delete().catch(() => {});
  }
});

afterAll(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

describe('server-controlled new-lead notifications', () => {
  it(
    'notifies only the approved active recipient scope',
    async () => {
      const fixture = await createRecipientFixture();
      const lead = await createLead('recipient-scope', {
        full_name: 'Approved Recipient Lead',
        phone_number: '281-555-0101',
        owner_user_id: fixture.owner.id,
      });

      const notifications =
        await waitForNotificationCount(
          lead.id,
          2 + (await activeAdminRecipientIds()).length
        );
      const recipientIds = notifications
        .map((notification) => notification.user_id)
        .sort();
      const expectedRecipientIds = [
        fixture.owner.id,
        fixture.supervisor.id,
        ...(await activeAdminRecipientIds()),
      ].sort();

      expect(recipientIds).toEqual(expectedRecipientIds);

      expect(new Set(recipientIds).size).toBe(
        expectedRecipientIds.length
      );
    },
    30000
  );

  it(
    'respects disabled preferences and defaults missing settings to enabled',
    async () => {
      const fixture = await createRecipientFixture({
        disableOwner: true,
        disableAdministrator: true,
      });
      const lead = await createLead('preferences', {
        full_name: 'Preference Test Lead',
        owner_user_id: fixture.owner.id,
      });

      const notifications =
        await waitForNotificationCount(
          lead.id,
          1 +
            (await activeAdminRecipientIds())
              .filter((id) => id !== fixture.administrator.id)
              .length
        );
      const recipientIds = notifications
        .map((notification) => notification.user_id)
        .sort();
      const expectedRecipientIds = [
        fixture.supervisor.id,
        ...(await activeAdminRecipientIds())
          .filter((id) => id !== fixture.administrator.id),
      ].sort();

      expect(recipientIds).toEqual(expectedRecipientIds);
    },
    30000
  );

  it(
    'uses server-controlled compatible notification fields',
    async () => {
      const fixture = await createRecipientFixture();
      const lead = await createLead('server-fields', {
        full_name: 'Server Field Lead',
        phone_number: '281-555-0199',
        owner_user_id: fixture.owner.id,
        title: 'Forged notification title',
        message: 'Forged notification message',
        type: 'warning',
        user_email: 'attacker@example.test',
        is_read: true,
        server_controlled: false,
      });

      const notifications =
        await waitForNotificationCount(
          lead.id,
          2 + (await activeAdminRecipientIds()).length
        );

      for (const notification of notifications) {
        expect(notification.title)
          .toBe('New lead received');
        expect(notification.message)
          .toBe('Server Field Lead - 281-555-0199');
        expect(notification.type).toBe('lead');
        expect(notification.related_entity_type)
          .toBe('Lead');
        expect(notification.related_entity_id)
          .toBe(lead.id);
        expect(notification.is_read).toBe(false);
        expect(notification.server_controlled).toBe(true);
        expect(notification.notification_source)
          .toBe('lead_on_create');
        expect(notification.notification_event_id)
          .toBe(`lead-created-${lead.id}`);
        expect(notification.deterministic_key)
          .toBe(notification.id);
        expect(notification.created_by_user_id)
          .toBe('system');
        expect(notification.created_date)
          .toBeTruthy();
      }
    },
    30000
  );

  it(
    'is idempotent across retry processing and lead updates',
    async () => {
      const fixture = await createRecipientFixture();
      const leadData = {
        full_name: 'Idempotency Test Lead',
        owner_user_id: fixture.owner.id,
      };
      const lead = await createLead(
        'retry-update',
        leadData
      );

      const initialNotifications =
        await waitForNotificationCount(
          lead.id,
          2 + (await activeAdminRecipientIds()).length
        );
      const initialIds = initialNotifications
        .map((notification) => notification.id)
        .sort();

      const retryCreated =
        await processNewLeadNotifications(
          lead.id,
          leadData,
          '2026-08-04T12:00:00.000Z'
        );

      expect(retryCreated).toBe(0);

      await lead.reference.update({
        full_name: 'Updated Lead Name',
        updated_date: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const finalNotifications =
        await notificationsForLead(lead.id);
      const finalIds = finalNotifications
        .map((notification) => notification.id)
        .sort();

      expect(finalNotifications).toHaveLength(
        initialNotifications.length
      );
      expect(finalIds).toEqual(initialIds);
    },
    30000
  );
});
