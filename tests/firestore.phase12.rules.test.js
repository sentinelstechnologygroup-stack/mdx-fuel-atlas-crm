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
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';

const USERS = Object.freeze({
  superAdmin: { uid: 'phase12-super-admin', role: 'super_admin', status: 'active' },
  administrator: { uid: 'phase12-administrator', role: 'administrator', status: 'active' },
  supervisor: { uid: 'phase12-supervisor', role: 'supervisor', status: 'active' },
  salesperson: { uid: 'phase12-salesperson', role: 'salesperson', status: 'active' },
  viewerSupport: { uid: 'phase12-viewer-support', role: 'viewer_support', status: 'active' },
  inactive: { uid: 'phase12-inactive', role: 'salesperson', status: 'inactive' },
});

let testEnvironment;

function profileFor(user) {
  const operationalRole = user.role === 'salesperson' || user.role === 'supervisor';

  return {
    uid: user.uid,
    email: `${user.uid}@example.test`,
    role: user.role === 'administrator' ? 'admin' : user.role,
    status: user.status,
    application_role: user.role,
    account_status: user.status,
    team_id: operationalRole ? 'team-alpha' : null,
    supervisor_user_id: user.role === 'salesperson' ? USERS.supervisor.uid : null,
    territory_ids: operationalRole ? ['territory-alpha'] : [],
  };
}

function firestoreFor(user) {
  const profile = profileFor(user);

  return testEnvironment
    .authenticatedContext(user.uid, {
      role: profile.role,
      status: profile.status,
      application_role: profile.application_role,
      account_status: profile.account_status,
      team_id: profile.team_id,
      supervisor_user_id: profile.supervisor_user_id,
      territory_ids: profile.territory_ids,
    })
    .firestore();
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
      await setDoc(doc(database, 'userProfiles', user.uid), profileFor(user));
    }

    await setDoc(doc(database, 'atlasAiUsage', 'phase12-usage'), {
      user_id: USERS.salesperson.uid,
      provider: 'test-provider',
      model: 'test-model',
      status: 'completed',
    });

    await setDoc(doc(database, 'messageDeliveries', 'phase12-delivery'), {
      channel: 'email',
      status: 'sent',
      recipientMasked: 'p***@example.test',
    });

    await setDoc(doc(database, 'entities', 'AuditLog', 'records', 'phase12-audit'), {
      action_type: 'phase12_audit_probe',
      actor_user_id: USERS.superAdmin.uid,
      immutable: true,
    });
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe('Phase 12 server-only telemetry and audit rules', () => {
  it.each(Object.entries(USERS))('denies %s access to ATLAS usage records', async (_key, user) => {
    const database = firestoreFor(user);
    const usageReference = doc(database, 'atlasAiUsage', 'phase12-usage');

    await assertFails(getDoc(usageReference));
    await assertFails(getDocs(collection(database, 'atlasAiUsage')));
    await assertFails(setDoc(doc(database, 'atlasAiUsage', 'forged'), {
      user_id: user.uid,
      status: 'completed',
    }));
    await assertFails(updateDoc(usageReference, { status: 'tampered' }));
    await assertFails(deleteDoc(usageReference));
  });

  it.each(Object.entries(USERS))('denies %s access to delivery records', async (_key, user) => {
    const database = firestoreFor(user);
    const deliveryReference = doc(database, 'messageDeliveries', 'phase12-delivery');

    await assertFails(getDoc(deliveryReference));
    await assertFails(getDocs(collection(database, 'messageDeliveries')));
    await assertFails(setDoc(doc(database, 'messageDeliveries', 'forged'), {
      channel: 'email',
      status: 'sent',
    }));
    await assertFails(updateDoc(deliveryReference, { status: 'tampered' }));
    await assertFails(deleteDoc(deliveryReference));
  });

  it('allows admin-tier audit reads but denies browser audit mutation', async () => {
    const superAdminFirestore = firestoreFor(USERS.superAdmin);
    const administratorFirestore = firestoreFor(USERS.administrator);
    const salespersonFirestore = firestoreFor(USERS.salesperson);
    const auditPath = ['entities', 'AuditLog', 'records', 'phase12-audit'];

    await assertSucceeds(getDoc(doc(superAdminFirestore, ...auditPath)));
    await assertSucceeds(getDoc(doc(administratorFirestore, ...auditPath)));
    await assertFails(getDoc(doc(salespersonFirestore, ...auditPath)));

    for (const database of [superAdminFirestore, administratorFirestore, salespersonFirestore]) {
      await assertFails(setDoc(doc(database, 'entities', 'AuditLog', 'records', 'forged-audit'), {
        action_type: 'browser_created',
        actor_user_id: USERS.salesperson.uid,
      }));
      await assertFails(updateDoc(doc(database, ...auditPath), { immutable: false }));
      await assertFails(deleteDoc(doc(database, ...auditPath)));
    }
  });
});
