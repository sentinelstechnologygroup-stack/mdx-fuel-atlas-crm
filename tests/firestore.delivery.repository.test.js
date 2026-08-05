import {
  createRequire,
} from "node:module";

const functionsRequire = createRequire(
  new URL("../functions/package.json", import.meta.url)
);

const {
  deleteApp,
  getApps,
  initializeApp,
} = functionsRequire("firebase-admin/app");

const {
  getFirestore,
} = functionsRequire("firebase-admin/firestore");

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  deliveryDocumentId,
  FirestoreDeliveryRecordRepository,
} from "../functions/src/firestoreDeliveryRepository.ts";

import {
  executeRecordedDelivery,
} from "../functions/src/messageDeliveryService.ts";

import {
  MockMessageProvider,
} from "../functions/src/messagingProviders.ts";

const PROJECT_ID = "mdx-fuel-atlas-crm-dev";
const APP_NAME = "phase9-delivery-repository-tests";

let app;
let firestore;
let repository;

function deliveryRecord(overrides = {}) {
  return {
    idempotencyKey: "lead-001-email",
    channel: "email",
    status: "processing",
    provider: "mock",
    reason: null,
    providerMessageId: null,
    sourceType: "Lead",
    sourceId: "lead-001",
    recipientHint: "s***@example.test",
    attemptCount: 1,
    createdAt: "2026-08-05T18:00:00.000Z",
    updatedAt: "2026-08-05T18:00:00.000Z",
    nextRetryAt: null,
    ...overrides,
  };
}

async function clearDeliveryRecords() {
  const snapshot = await firestore
    .collection("system")
    .doc("messageDeliveries")
    .collection("records")
    .get();

  if (snapshot.empty) {
    return;
  }

  const batch = firestore.batch();

  for (const document of snapshot.docs) {
    batch.delete(document.ref);
  }

  await batch.commit();
}

beforeAll(() => {
  app = getApps().find(
    (candidate) => candidate.name === APP_NAME
  ) || initializeApp(
    {
      projectId: PROJECT_ID,
    },
    APP_NAME
  );

  firestore = getFirestore(app);
  repository =
    new FirestoreDeliveryRecordRepository(firestore);
});

beforeEach(async () => {
  await clearDeliveryRecords();
});

afterAll(async () => {
  await clearDeliveryRecords();
  await deleteApp(app);
});

describe("Phase 9 Firestore delivery repository", () => {
  it("uses stable SHA-256 document identifiers", () => {
    const first = deliveryDocumentId("lead-001-email");
    const second = deliveryDocumentId("lead-001-email");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates and reads a delivery record", async () => {
    const record = deliveryRecord();

    expect(await repository.create(record)).toBe(true);
    expect(await repository.get(record.idempotencyKey))
      .toEqual(record);
  });

  it("rejects a duplicate idempotency record", async () => {
    const record = deliveryRecord();

    expect(await repository.create(record)).toBe(true);
    expect(await repository.create(record)).toBe(false);
  });

  it("updates an existing delivery record", async () => {
    const record = deliveryRecord();

    await repository.create(record);

    await repository.update(record.idempotencyKey, {
      status: "sent",
      providerMessageId: "mock-email-001",
      updatedAt: "2026-08-05T18:01:00.000Z",
    });

    expect(await repository.get(record.idempotencyKey))
      .toMatchObject({
        status: "sent",
        providerMessageId: "mock-email-001",
        attemptCount: 1,
      });
  });

  it("supports recorded delivery end to end", async () => {
    const request = {
      idempotencyKey: "opportunity-001-email",
      recipient: "sales@example.test",
      subject: "Opportunity update",
      message: "The opportunity was updated.",
      sourceType: "Opportunity",
      sourceId: "opportunity-001",
    };

    const first = await executeRecordedDelivery(
      new MockMessageProvider("email"),
      request,
      repository
    );

    const duplicate = await executeRecordedDelivery(
      new MockMessageProvider("email"),
      request,
      repository
    );

    expect(first.duplicate).toBe(false);
    expect(first.record.status).toBe("sent");
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.record.attemptCount).toBe(1);
  });
});
