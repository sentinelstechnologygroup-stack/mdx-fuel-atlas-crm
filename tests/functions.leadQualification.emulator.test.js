import {createRequire} from 'node:module';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

const requireFromFunctions = createRequire(
  new URL('../functions/package.json', import.meta.url)
);
const {getApps, initializeApp} = requireFromFunctions('firebase-admin/app');
const {getFirestore} = requireFromFunctions('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'mdx-fuel-atlas-crm-dev';
if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
const firestore = getFirestore();
const runId = `phase13-qualification-${Date.now()}`;
const references = [];
let processLeadQualification;

function track(reference) {
  references.push(reference);
  return reference;
}

async function createLead(label, values = {}) {
  const reference = track(firestore
    .collection('entities/Lead/records').doc(`${runId}-${label}`));
  await reference.set({
    full_name: `Lead ${label}`,
    owner_user_id: `${runId}-owner`,
    assigned_to: `${runId}-owner@example.test`,
    lead_status: 'New',
    ...values,
  });
  return reference;
}

function provider(output) {
  return {
    execute: async () => ({
      output,
      provider: 'test',
      model: 'deterministic-test',
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsd: 0,
    }),
  };
}

beforeAll(async () => {
  ({processLeadQualification} = await import(
    '../functions/lib/leadQualification.js'
  ));
});

afterAll(async () => {
  const collections = [
    'entities/Task/records',
    'entities/Notification/records',
    'entities/AuditLog/records',
    'atlasAiUsage',
  ];
  for (const path of collections) {
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

describe('Phase 13 Firebase lead qualification', () => {
  it('qualifies a high score atomically with deterministic side effects', async () => {
    const lead = await createLead('high');
    const first = await processLeadQualification(
      lead.id,
      provider({score: 88, classification: 'Hot', reasoning: 'Strong fit.'}),
      '2026-08-18T14:00:00.000Z'
    );
    const second = await processLeadQualification(
      lead.id,
      provider({score: 99, classification: 'Hot', reasoning: 'Retry.'}),
      '2026-08-18T14:01:00.000Z'
    );
    expect(first).toMatchObject({qualified: true, score: 88, duplicate: false});
    expect(second).toMatchObject({qualified: true, score: 88, duplicate: true});
    expect((await lead.get()).data()).toMatchObject({
      lead_status: 'Qualified',
      ai_quality_score: 88,
      ai_classification: 'Hot',
    });
    const tasks = await firestore.collection('entities/Task/records')
      .where('related_lead_id', '==', lead.id).get();
    const audits = await firestore.collection('entities/AuditLog/records')
      .where('lead_id', '==', lead.id).get();
    expect(tasks.size).toBe(1);
    expect(audits.size).toBe(1);
  });

  it('records a low score without qualifying or creating a task', async () => {
    const lead = await createLead('low');
    const result = await processLeadQualification(
      lead.id,
      provider({score: 32, classification: 'Cold', reasoning: 'Incomplete.'}),
      '2026-08-18T14:00:00.000Z'
    );
    expect(result).toMatchObject({qualified: false, score: 32});
    expect((await lead.get()).data()).toMatchObject({
      lead_status: 'New',
      ai_quality_score: 32,
    });
    const tasks = await firestore.collection('entities/Task/records')
      .where('related_lead_id', '==', lead.id).get();
    expect(tasks.empty).toBe(true);
  });

  it('fails closed when the provider is unavailable', async () => {
    const lead = await createLead('unavailable');
    const result = await processLeadQualification(
      lead.id,
      undefined,
      '2026-08-18T14:00:00.000Z'
    );
    expect(result).toMatchObject({
      qualified: false,
      score: 0,
      status: 'unavailable',
    });
    expect((await lead.get()).data().lead_status).toBe('New');
  });
});
