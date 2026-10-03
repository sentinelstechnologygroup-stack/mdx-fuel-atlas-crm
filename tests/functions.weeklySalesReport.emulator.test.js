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
const runId = `phase13-weekly-${Date.now()}`;
const references = [];
let processWeeklySalesReport;

function track(reference) {
  references.push(reference);
  return reference;
}

beforeAll(async () => {
  ({processWeeklySalesReport} = await import(
    '../functions/lib/weeklySalesReport.js'
  ));
  const config = track(firestore
    .collection('entities/ReportConfig/records').doc(`${runId}-config`));
  await config.set({
    name: `${runId} Lead Volume`,
    entity_type: 'Lead',
    config: {
      fields: ['id', 'full_name', 'estimated_monthly_gallons'],
      yAxis: 'estimated_monthly_gallons',
      aggregation: 'sum',
    },
  });
  for (const [id, gallons] of [['one', 1000], ['two', 2500]]) {
    const lead = track(firestore
      .collection('entities/Lead/records').doc(`${runId}-${id}`));
    await lead.set({
      full_name: `${runId} ${id}`,
      estimated_monthly_gallons: gallons,
    });
  }
  const profiles = [
    ['admin', 'administrator', 'active'],
    ['super', 'super_admin', 'active'],
    ['sales', 'salesperson', 'active'],
    ['inactive', 'administrator', 'inactive'],
  ];
  for (const [id, role, status] of profiles) {
    const profile = track(firestore.collection('userProfiles')
      .doc(`${runId}-${id}`));
    await profile.set({
      email: `${runId}-${id}@example.test`,
      application_role: role,
      account_status: status,
    });
  }
});

afterAll(async () => {
  const runs = await firestore.collection('system/weeklySalesReports/runs').get();
  for (const document of runs.docs) {
    if (JSON.stringify(document.data()).includes(runId)) {
      references.push(document.ref);
    }
  }
  for (const reference of references.reverse()) {
    await reference.delete().catch(() => undefined);
  }
});

describe('Phase 13 weekly sales report', () => {
  it('builds one export and emails only active management', async () => {
    const deliveries = [];
    const exports = [];
    const result = await processWeeklySalesReport(
      '2026-08-24T14:00:00.000Z',
      async (recipient, subject, body, key) => {
        deliveries.push({recipient, subject, body, key});
        return 'sent';
      },
      async (path, content) => exports.push({path, content})
    );
    expect(result).toMatchObject({
      weekKey: '2026-08-24',
      duplicate: false,
      recipients: 2,
      sent: 2,
    });
    expect(exports).toHaveLength(1);
    expect(exports[0].path).toBe(
      'system/reports/weekly/2026-08-24.xlsx'
    );
    expect(exports[0].content.length).toBeGreaterThan(1000);
    expect(deliveries).toHaveLength(2);
    expect(deliveries.map((item) => item.recipient).sort()).toEqual([
      `${runId}-admin@example.test`,
      `${runId}-super@example.test`,
    ]);
    expect(deliveries[0].body).toContain('Sum of estimated_monthly_gallons');
  });

  it('is idempotent for the same America/Chicago report week', async () => {
    let deliveryCalls = 0;
    let exportCalls = 0;
    const result = await processWeeklySalesReport(
      '2026-08-25T14:00:00.000Z',
      async () => {
        deliveryCalls++;
        return 'sent';
      },
      async () => {
        exportCalls++;
      }
    );
    expect(result.duplicate).toBe(true);
    expect(deliveryCalls).toBe(0);
    expect(exportCalls).toBe(0);
  });
});
