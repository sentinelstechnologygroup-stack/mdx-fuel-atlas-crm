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
  executeMessageDeliveryCallable,
  normalizeMessageDeliveryInput,
  requireMessageDeliveryActor,
} from "../functions/src/messageDeliveryCallable.ts";

const PROJECT_ID = "mdx-fuel-atlas-crm-dev";
const APP_NAME = "phase9-message-callable-tests";

let app;
let firestore;

async function clearCollections() {
  const collections = [
    firestore.collection("userProfiles"),
    firestore
      .collection("system")
      .doc("messageDeliveries")
      .collection("records"),
  ];

  for (const collection of collections) {
    const snapshot = await collection.get();

    if (snapshot.empty) {
      continue;
    }

    const batch = firestore.batch();

    for (const document of snapshot.docs) {
      batch.delete(document.ref);
    }

    await batch.commit();
  }
}

async function seedProfile(
  uid,
  status = "active"
) {
  await firestore
    .collection("userProfiles")
    .doc(uid)
    .set({
      uid,
      application_role: "salesperson",
      account_status: status,
    });
}

function input(overrides = {}) {
  return {
    channel: "email",
    recipient: "sales@example.test",
    subject: "New lead",
    message: "A new lead was assigned.",
    sourceType: "Lead",
    sourceId: "lead-001",
    eventKey: "assigned-salesperson",
    ...overrides,
  };
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
});

beforeEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await clearCollections();
  await deleteApp(app);
});

describe("Phase 9 message-delivery callable service", () => {
  it("requires authentication", async () => {
    await expect(
      requireMessageDeliveryActor(
        firestore,
        undefined
      )
    ).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("denies inactive users", async () => {
    await seedProfile("inactive-user", "inactive");

    await expect(
      requireMessageDeliveryActor(
        firestore,
        "inactive-user"
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("normalizes a stable server idempotency key", () => {
    const normalized =
      normalizeMessageDeliveryInput(input());

    expect(normalized.channel).toBe("email");
    expect(normalized.request.idempotencyKey)
      .toBe(
        "lead:lead-001:assigned-salesperson:email"
      );
  });

  it("rejects unsupported channels", () => {
    expect(() =>
      normalizeMessageDeliveryInput(
        input({channel: "fax"})
      )
    ).toThrow();
  });

  it("requires email subjects", () => {
    expect(() =>
      normalizeMessageDeliveryInput(
        input({subject: ""})
      )
    ).toThrow();
  });

  it("skips email safely when no provider is configured", async () => {
    await seedProfile("active-user");

    const result = await executeMessageDeliveryCallable(
      {
        firestore,
        environment: {},
      },
      "active-user",
      input()
    );

    expect(result).toMatchObject({
      channel: "email",
      status: "skipped",
      provider: null,
      reason: "provider_not_configured",
      duplicate: false,
      attemptCount: 1,
      requestedBy: "active-user",
    });
  });

  it("prevents duplicate callable delivery", async () => {
    await seedProfile("active-user");

    const dependencies = {
      firestore,
      environment: {},
    };

    const first = await executeMessageDeliveryCallable(
      dependencies,
      "active-user",
      input()
    );

    const second = await executeMessageDeliveryCallable(
      dependencies,
      "active-user",
      input()
    );

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.attemptCount).toBe(1);
  });

  it("supports SMS without requiring an email provider", async () => {
    await seedProfile("active-user");

    const result = await executeMessageDeliveryCallable(
      {
        firestore,
        environment: {},
      },
      "active-user",
      input({
        channel: "sms",
        subject: undefined,
        recipient: "+15555550123",
      })
    );

    expect(result).toMatchObject({
      channel: "sms",
      status: "skipped",
      reason: "provider_not_configured",
    });
  });
});
