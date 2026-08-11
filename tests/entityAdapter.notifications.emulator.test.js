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

  items.push({
    entity,
    recordId,
  });

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

describe(
  'Firestore entity adapter server-controlled notifications',
  () => {
    it(
      'denies browser-created notifications for active salespeople',
      async () => {
        await signInAs(ACCOUNTS.salesperson);

        await expect(
          notificationEntity.create({
            title: 'Browser-created notification',
            message:
              'Notification creation must remain server-controlled.',
            type: 'info',
            user_id: 'salesperson-user',
            user_email: ACCOUNTS.salesperson,
            is_read: false,
          })
        ).rejects.toBeDefined();
      }
    );

    it(
      'denies forged browser notification ownership',
      async () => {
        await signInAs(ACCOUNTS.salesperson);

        await expect(
          notificationEntity.create({
            title: 'Forged notification',
            message:
              'Forged recipient fields must not bypass server control.',
            type: 'info',
            user_id: 'forged-user',
            user_email: 'forged@example.test',
            created_by_user_id: 'forged-user',
            last_modified_by_user_id: 'forged-user',
            is_read: false,
          })
        ).rejects.toBeDefined();
      }
    );

    it(
      'allows users to manage their own notification settings',
      async () => {
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
          user_email: ACCOUNTS.salesperson,
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
          user_email: ACCOUNTS.salesperson,
        });

        const records = await settingsEntity.filter({
          user_email: ACCOUNTS.salesperson,
        });

        expect(
          records.map((record) => record.id)
        ).toContain(created.id);
      }
    );

    it(
      'denies Viewer Support browser notification creation',
      async () => {
        await signInAs(ACCOUNTS.viewerSupport);

        await expect(
          notificationEntity.create({
            title: 'Viewer Support notification',
            message:
              'Viewer Support notification creation is server-controlled.',
            type: 'info',
            user_id: 'viewer-support-user',
            user_email: ACCOUNTS.viewerSupport,
            is_read: false,
          })
        ).rejects.toBeDefined();
      }
    );
  }
);
