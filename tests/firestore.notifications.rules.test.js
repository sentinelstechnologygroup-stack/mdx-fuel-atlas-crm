// tests/firestore.notifications.rules.test.js
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';

const USERS = Object.freeze({
  alice: {
    uid: 'notification-alice',
    email: 'notification-alice@example.test',
    role: 'salesperson',
    status: 'active',
  },
  bob: {
    uid: 'notification-bob',
    email: 'notification-bob@example.test',
    role: 'supervisor',
    status: 'active',
  },
  inactive: {
    uid: 'notification-inactive',
    email: 'notification-inactive@example.test',
    role: 'salesperson',
    status: 'inactive',
  },
});

let testEnvironment;

function profileFor(user) {
  return {
    uid: user.uid,
    email: user.email,
    application_role: user.role,
    account_status: user.status,
    role: user.role,
    status: user.status,
    team_id: null,
    supervisor_user_id: null,
    territory_ids: [],
  };
}

function firestoreFor(user) {
  return testEnvironment
    .authenticatedContext(user.uid, {
      application_role: user.role,
      account_status: user.status,
    })
    .firestore();
}

function entityDocument(database, entityName, recordId) {
  return doc(
    database,
    'entities',
    entityName,
    'records',
    recordId
  );
}

function entityCollection(database, entityName) {
  return collection(
    database,
    'entities',
    entityName,
    'records'
  );
}

function notificationData(user, overrides = {}) {
  return {
    title: 'Notification',
    message: 'Notification message',
    type: 'info',
    is_read: false,
    user_id: user.uid,
    user_email: user.email,
    created_by_user_id: user.uid,
    last_modified_by_user_id: user.uid,
    ...overrides,
  };
}

function settingsData(user, overrides = {}) {
  return {
    user_id: user.uid,
    user_email: user.email,
    notify_new_leads: true,
    notify_opp_closing: true,
    notify_tasks: true,
    days_before_deadline: 3,
    created_by_user_id: user.uid,
    last_modified_by_user_id: user.uid,
    ...overrides,
  };
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();

    for (const user of Object.values(USERS)) {
      await setDoc(
        doc(database, 'userProfiles', user.uid),
        profileFor(user)
      );
    }

    await setDoc(
      entityDocument(
        database,
        'Notification',
        'alice-notification'
      ),
      notificationData(USERS.alice)
    );

    await setDoc(
      entityDocument(
        database,
        'Notification',
        'bob-notification'
      ),
      notificationData(USERS.bob)
    );

    await setDoc(
      entityDocument(
        database,
        'Notification',
        'inactive-notification'
      ),
      notificationData(USERS.inactive)
    );

    await setDoc(
      entityDocument(
        database,
        'Notification',
        'alice-legacy-notification'
      ),
      {
        title: 'Legacy notification',
        message: 'Email-owned legacy record',
        type: 'info',
        is_read: false,
        user_email: USERS.alice.email,
      }
    );

    await setDoc(
      entityDocument(
        database,
        'NotificationSettings',
        'alice-settings'
      ),
      settingsData(USERS.alice)
    );

    await setDoc(
      entityDocument(
        database,
        'NotificationSettings',
        'bob-settings'
      ),
      settingsData(USERS.bob)
    );
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe('Phase 4 self-owned notification reads', () => {
  it('allows only the owner to get a notification', async () => {
    await assertSucceeds(
      getDoc(
        entityDocument(
          firestoreFor(USERS.alice),
          'Notification',
          'alice-notification'
        )
      )
    );

    await assertFails(
      getDoc(
        entityDocument(
          firestoreFor(USERS.bob),
          'Notification',
          'alice-notification'
        )
      )
    );

    await assertFails(
      getDoc(
        entityDocument(
          firestoreFor(USERS.inactive),
          'Notification',
          'inactive-notification'
        )
      )
    );
  });

  it('allows a user-ID-constrained list and denies an unrestricted list', async () => {
    const database = firestoreFor(USERS.alice);
    const ownQuery = query(
      entityCollection(database, 'Notification'),
      where('user_id', '==', USERS.alice.uid)
    );

    const snapshot = await assertSucceeds(getDocs(ownQuery));

    expect(snapshot.docs.map((item) => item.id)).toEqual([
      'alice-notification',
    ]);

    await assertFails(
      getDocs(entityCollection(database, 'Notification'))
    );
  });

  it('allows a legacy email-constrained notification query', async () => {
    const database = firestoreFor(USERS.alice);
    const ownQuery = query(
      entityCollection(database, 'Notification'),
      where('user_email', '==', USERS.alice.email)
    );

    const snapshot = await assertSucceeds(getDocs(ownQuery));

    expect(snapshot.docs.map((item) => item.id).sort()).toEqual([
      'alice-legacy-notification',
      'alice-notification',
    ]);
  });
});

describe('Phase 4 self-owned notification writes', () => {
  it('allows canonical self-recipient creation and denies forged recipients', async () => {
    const database = firestoreFor(USERS.alice);

    await assertSucceeds(
      setDoc(
        entityDocument(
          database,
          'Notification',
          'alice-created-notification'
        ),
        notificationData(USERS.alice)
      )
    );

    await assertFails(
      setDoc(
        entityDocument(
          database,
          'Notification',
          'forged-notification'
        ),
        notificationData(USERS.bob)
      )
    );

    await assertFails(
      setDoc(
        entityDocument(
          database,
          'Notification',
          'missing-user-id-notification'
        ),
        {
          title: 'Missing canonical user ID',
          message: 'Invalid notification',
          user_email: USERS.alice.email,
          is_read: false,
        }
      )
    );
  });

  it('allows canonicalization of an owned legacy notification', async () => {
    const database = firestoreFor(USERS.alice);

    await assertSucceeds(
      updateDoc(
        entityDocument(
          database,
          'Notification',
          'alice-legacy-notification'
        ),
        {
          user_id: USERS.alice.uid,
          user_email: USERS.alice.email,
          is_read: true,
        }
      )
    );

    const snapshot = await getDoc(
      entityDocument(
        database,
        'Notification',
        'alice-legacy-notification'
      )
    );

    expect(snapshot.data()).toMatchObject({
      user_id: USERS.alice.uid,
      user_email: USERS.alice.email,
      is_read: true,
    });
  });

  it('denies notification ownership reassignment', async () => {
    await assertFails(
      updateDoc(
        entityDocument(
          firestoreFor(USERS.alice),
          'Notification',
          'alice-notification'
        ),
        {
          user_id: USERS.bob.uid,
          user_email: USERS.bob.email,
        }
      )
    );
  });

  it('allows an owner to delete their notification but not another user notification', async () => {
    const database = firestoreFor(USERS.alice);

    await assertSucceeds(
      deleteDoc(
        entityDocument(
          database,
          'Notification',
          'alice-notification'
        )
      )
    );

    await assertFails(
      deleteDoc(
        entityDocument(
          database,
          'Notification',
          'bob-notification'
        )
      )
    );
  });
});

describe('Phase 4 self-owned notification settings', () => {
  it('restricts settings reads and writes to the authenticated owner', async () => {
    const database = firestoreFor(USERS.alice);
    const ownQuery = query(
      entityCollection(database, 'NotificationSettings'),
      where('user_id', '==', USERS.alice.uid)
    );

    const snapshot = await assertSucceeds(getDocs(ownQuery));

    expect(snapshot.docs.map((item) => item.id)).toEqual([
      'alice-settings',
    ]);

    await assertFails(
      getDoc(
        entityDocument(
          database,
          'NotificationSettings',
          'bob-settings'
        )
      )
    );

    await assertSucceeds(
      updateDoc(
        entityDocument(
          database,
          'NotificationSettings',
          'alice-settings'
        ),
        {
          user_id: USERS.alice.uid,
          user_email: USERS.alice.email,
          notify_tasks: false,
        }
      )
    );

    await assertFails(
      setDoc(
        entityDocument(
          database,
          'NotificationSettings',
          'forged-settings'
        ),
        settingsData(USERS.bob)
      )
    );
  });
});
