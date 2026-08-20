import {createRequire} from 'node:module';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const requireFromFunctions = createRequire(
  new URL('../functions/package.json', import.meta.url)
);
const {getApps, initializeApp} = requireFromFunctions('firebase-admin/app');
const {getFirestore} = requireFromFunctions('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || 'mdx-fuel-atlas-crm-dev';
if (getApps().length === 0) initializeApp({projectId});
const firestore = getFirestore();
const runId = `phase13-stale-${Date.now()}`;
const references = [];
let processStaleOpportunityScan;
let processStaleOpportunityRecheck;

function track(reference) {
  references.push(reference);
  return reference;
}

async function entity(name, id, data) {
  const reference = track(firestore
    .collection(`entities/${name}/records`).doc(`${runId}-${id}`));
  await reference.set(data);
  return reference;
}

beforeAll(async () => {
  ({
    processStaleOpportunityScan,
    processStaleOpportunityRecheck,
  } = await import('../functions/lib/staleOpportunity.js'));
});

afterAll(async () => {
  const paths = [
    'system/staleOpportunityRechecks/records',
    'entities/Notification/records',
    'entities/Task/records',
    'entities/AuditLog/records',
    'atlasAiUsage',
  ];
  for (const path of paths) {
    const snapshot = await firestore.collection(path).get();
    for (const document of snapshot.docs) {
      if (JSON.stringify(document.data()).includes(runId)) {
        references.push(document.ref);
      }
    }
  }
  for (const reference of references.reverse()) {
    await reference.delete().catch(() => undefined);
  }
});

describe('Phase 13 stale opportunity workflow', () => {
  it('enqueues only open opportunities stale at the 14-day boundary', async () => {
    const stale = await entity('Opportunity', 'stale', {
      lead_name: `${runId} Stale`,
      lead_id: `${runId}-lead-stale`,
      deal_stage: 'Proposal',
      owner_user_id: `${runId}-owner`,
      assigned_to: `${runId}-owner@example.test`,
      created_date: '2026-07-01T12:00:00.000Z',
    });
    const fresh = await entity('Opportunity', 'fresh', {
      lead_name: `${runId} Fresh`,
      deal_stage: 'Proposal',
      created_date: '2026-07-01T12:00:00.000Z',
    });
    await entity('Opportunity', 'closed', {
      lead_name: `${runId} Closed`,
      deal_stage: 'Closed Won',
      created_date: '2026-07-01T12:00:00.000Z',
    });
    await entity('Activity', 'fresh-activity', {
      opportunity_id: fresh.id,
      date: '2026-08-05T13:00:00.000Z',
    });
    const enqueued = [];
    const result = await processStaleOpportunityScan(
      '2026-08-19T12:00:00.000Z',
      async (pendingId, taskId) => enqueued.push({pendingId, taskId})
    );
    expect(result.stale).toBeGreaterThanOrEqual(1);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].pendingId).toBeTruthy();
    const second = await processStaleOpportunityScan(
      '2026-08-19T12:05:00.000Z',
      async (pendingId, taskId) => enqueued.push({pendingId, taskId})
    );
    expect(second.enqueued).toBe(0);
    const notices = await firestore.collection('entities/Notification/records')
      .where('related_entity_id', '==', stale.id).get();
    expect(notices.size).toBe(1);
  });

  it('cancels the delayed recheck when activity is recorded', async () => {
    const opportunity = await entity('Opportunity', 'cancel', {
      lead_name: `${runId} Cancel`,
      deal_stage: 'Proposal',
      created_date: '2026-07-01T12:00:00.000Z',
    });
    const queued = [];
    await processStaleOpportunityScan(
      '2026-08-20T12:00:00.000Z',
      async (pendingId) => queued.push(pendingId)
    );
    const pendingSnapshot = await firestore
      .collection('system/staleOpportunityRechecks/records')
      .where('opportunity_id', '==', opportunity.id).get();
    const pending = pendingSnapshot.docs[0];
    await entity('Activity', 'cancel-activity', {
      opportunity_id: opportunity.id,
      date: '2026-08-21T12:00:00.000Z',
    });
    const result = await processStaleOpportunityRecheck(
      pending.id,
      undefined,
      '2026-08-23T12:00:00.000Z'
    );
    expect(result.status).toBe('cancelled');
    expect((await pending.ref.get()).data().cancellation_reason)
      .toBe('activity_recorded');
  });

  it('creates exactly one fallback task when still stale', async () => {
    const opportunity = await entity('Opportunity', 'followup', {
      lead_name: `${runId} Followup`,
      deal_stage: 'Negotiation',
      owner_user_id: `${runId}-owner`,
      assigned_to: `${runId}-owner@example.test`,
      created_date: '2026-07-01T12:00:00.000Z',
    });
    await processStaleOpportunityScan(
      '2026-08-24T12:00:00.000Z',
      async () => undefined
    );
    const pendingSnapshot = await firestore
      .collection('system/staleOpportunityRechecks/records')
      .where('opportunity_id', '==', opportunity.id).get();
    const pending = pendingSnapshot.docs[0];
    const first = await processStaleOpportunityRecheck(
      pending.id,
      undefined,
      '2026-08-27T12:00:00.000Z'
    );
    const second = await processStaleOpportunityRecheck(
      pending.id,
      undefined,
      '2026-08-27T12:01:00.000Z'
    );
    expect(first.status).toBe('completed');
    expect(second.status).toBe('duplicate');
    const tasks = await firestore.collection('entities/Task/records')
      .where('related_opportunity_id', '==', opportunity.id).get();
    expect(tasks.size).toBe(1);
    expect(tasks.docs[0].data().description).toContain('17+ days');
  });
});
