// tests/entityAdapter.notifications.emulator.test.js
import {
  afterAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  signInWithFirebase,
  signOutFromFirebase,
} from '@/auth/firebaseAuthService';
import {
  firebaseAuth,
} from '@/firebase/client';
import {
  createFirestoreEntity,
} from '@/firebase/entityAdapter';

const PASSWORD = 'AtlasTest!2026';

const ACCOUNTS = Object.freeze({
  salesperson: 'salesperson@example.test',
  supervisor: 'supervisor@example.test',
  viewerSupport: 'viewer@example.test',
});

const notificationEntity =
  createFirestoreEntity('Notification');
const settingsEntity =
  createFirestoreEntity('NotificationSettings');

const cleanupByAccount = new Map();

async function signInAs(email) {
  if (firebaseAuth.currentUser) {
    await signOutFromFirebase();
  }

  return signInWithFirebase(email, PASSWORD);
}

function registerCleanup(email, entity, recordId) {
  const items = cleanupByAccount.get(email) ?? [];
  items.push({ entity, recordId });
  cleanupByAccount.set(email, items);
}

afterAll(async () => {
  for (const [email, items] of cleanupByAccount.entries()) {
    await signInAs(email);

    for (const item of items) {
      await item.entity
        .delete(item.recordId)
        .catch(() => undefined);
    }
  }

  if (firebaseAuth.currentUser) {
    await signOutFromFirebase();
  }
});

describe('Firestore entity adapter self-owned notifications', () => {
  it('overrides forged notification recipient fields', async () => {
    await signInAs(ACCOUNTS.salesperson);

    const created = await notificationEntity.create({
      title: 'Canonical recipient',
      message: 'Recipient fields must be overwritten.',
      type: 'info',
      user_id: 'forged-user',
      user_email: 'forged@example.test',
      created_by_user_id: 'forged-user',
      last_modified_by_user_id: 'forged-user',
      is_read: false,
    });

    registerCleanup(
      ACCOUNTS.salesperson,
      notificationEntity,
      created.id
    );

    expect(created).toMatchObject({
      user_id: 'salesperson-user',
      user_email: 'salesperson@example.test',
      created_by_user_id: 'salesperson-user',
      last_modified_by_user_id: 'salesperson-user',
    });

    const stored = await notificationEntity.get(created.id);

    expect(stored).toMatchObject({
      user_id: 'salesperson-user',
      user_email: 'salesperson@example.test',
    });
  });

  it('lists only notifications owned by the current user', async () => {
    await signInAs(ACCOUNTS.salesperson);

    const salespersonNotification =
      await notificationEntity.create({
        title: 'Salesperson notification',
        message: 'Owned by salesperson.',
        type: 'info',
        is_read: false,
      });

    registerCleanup(
      ACCOUNTS.salesperson,
      notificationEntity,
      salespersonNotification.id
    );

    await signInAs(ACCOUNTS.supervisor);

    const supervisorNotification =
      await notificationEntity.create({
        title: 'Supervisor notification',
        message: 'Owned by supervisor.',
        type: 'info',
        is_read: false,
      });

    registerCleanup(
      ACCOUNTS.supervisor,
      notificationEntity,
      supervisorNotification.id
    );

    await signInAs(ACCOUNTS.salesperson);

    const records = await notificationEntity.list(
      '-created_date',
      100
    );

    const fixtureIds = records
      .filter((record) =>
        [
          salespersonNotification.id,
          supervisorNotification.id,
        ].includes(record.id)
      )
      .map((record) => record.id);

    expect(fixtureIds).toContain(
      salespersonNotification.id
    );
    expect(fixtureIds).not.toContain(
      supervisorNotification.id
    );
  });

  it('preserves canonical ownership during updates', async () => {
    await signInAs(ACCOUNTS.salesperson);

    const created = await notificationEntity.create({
      title: 'Update ownership test',
      message: 'Initial message.',
      type: 'info',
      is_read: false,
    });

    registerCleanup(
      ACCOUNTS.salesperson,
      notificationEntity,
      created.id
    );

    const updated = await notificationEntity.update(
      created.id,
      {
        is_read: true,
        user_id: 'forged-user',
        user_email: 'forged@example.test',
        last_modified_by_user_id: 'forged-user',
      }
    );

    expect(updated).toMatchObject({
      is_read: true,
      user_id: 'salesperson-user',
      user_email: 'salesperson@example.test',
      last_modified_by_user_id: 'salesperson-user',
    });
  });

  it('canonicalizes notification settings creation and updates', async () => {
    await signInAs(ACCOUNTS.salesperson);

    const created = await settingsEntity.create({
      user_id: 'forged-user',
      user_email: 'forged@example.test',
      notify_new_leads: true,
      notify_opp_closing: true,
      notify_tasks: true,
      days_before_deadline: 3,
    });

    registerCleanup(
      ACCOUNTS.salesperson,
      settingsEntity,
      created.id
    );

    expect(created).toMatchObject({
      user_id: 'salesperson-user',
      user_email: 'salesperson@example.test',
    });

    const updated = await settingsEntity.update(
      created.id,
      {
        notify_tasks: false,
        user_id: 'forged-user',
        user_email: 'forged@example.test',
      }
    );

    expect(updated).toMatchObject({
      notify_tasks: false,
      user_id: 'salesperson-user',
      user_email: 'salesperson@example.test',
    });

    const records = await settingsEntity.filter({
      user_email: 'salesperson@example.test',
    });

    expect(
      records.map((record) => record.id)
    ).toContain(created.id);
  });

  it('allows active Viewer Support accounts to manage only their own notifications', async () => {
    await signInAs(ACCOUNTS.viewerSupport);

    const created = await notificationEntity.create({
      title: 'Viewer Support notification',
      message: 'Self-owned notification.',
      type: 'info',
      is_read: false,
    });

    registerCleanup(
      ACCOUNTS.viewerSupport,
      notificationEntity,
      created.id
    );

    const records = await notificationEntity.list();

    expect(
      records.map((record) => record.id)
    ).toContain(created.id);

    expect(
      records.every(
        (record) =>
          record.user_id === 'viewer-support-user'
      )
    ).toBe(true);
  });
});
