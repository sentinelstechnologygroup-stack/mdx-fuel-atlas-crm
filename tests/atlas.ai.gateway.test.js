import {createRequire} from "node:module";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  AI_PROVIDER_TIMEOUT_MS,
  executeAtlasAiCallable,
  normalizeAtlasAiRequest,
  requireAtlasAiActor,
} from "../functions/src/atlasAiGateway.ts";

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

const PROJECT_ID = "mdx-fuel-atlas-crm-dev";
const APP_NAME = "phase11-ai-gateway-tests";

let app;
let firestore;

async function clearCollections() {
  const collections = [
    firestore.collection("userProfiles"),
    firestore
      .collection("system")
      .doc("aiRateLimits")
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

  await firestore
    .collection("system")
    .doc("aiConfiguration")
    .delete();
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

function request(overrides = {}) {
  return {
    operation: "lead_analysis",
    input: "Analyze the assigned lead.",
    context: {
      leadId: "lead-001",
    },
    ...overrides,
  };
}

beforeAll(() => {
  app = getApps().find(
    (candidate) => candidate.name === APP_NAME
  ) || initializeApp(
    {projectId: PROJECT_ID},
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

describe("Phase 11 ATLAS AI gateway", () => {
  it("defines a bounded provider timeout", () => {
    expect(AI_PROVIDER_TIMEOUT_MS).toBe(30000);
  });

  it("requires authentication", async () => {
    await expect(
      requireAtlasAiActor(firestore, undefined)
    ).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("denies inactive users", async () => {
    await seedProfile("inactive-user", "inactive");

    await expect(
      requireAtlasAiActor(
        firestore,
        "inactive-user"
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects unsupported operations", () => {
    expect(() =>
      normalizeAtlasAiRequest(
        request({operation: "arbitrary_code"})
      )
    ).toThrow();
  });

  it("rejects unexpected request fields", () => {
    expect(() =>
      normalizeAtlasAiRequest(
        request({apiKey: "must-not-be-accepted"})
      )
    ).toThrow();
  });

  it("rejects oversized input", () => {
    expect(() =>
      normalizeAtlasAiRequest(
        request({input: "x".repeat(12001)})
      )
    ).toThrow();
  });

  it("defaults safely to disabled", async () => {
    await seedProfile("active-user");

    const result = await executeAtlasAiCallable(
      {
        firestore,
        now: () => 1700000000000,
      },
      "active-user",
      request()
    );

    expect(result).toMatchObject({
      success: false,
      status: "unavailable",
      operation: "lead_analysis",
      reason: "ai_disabled",
    });

    expect(result.requestId).toHaveLength(24);
  });

  it("does not imply a provider exists for client mode", async () => {
    await seedProfile("active-user");

    await firestore
      .collection("system")
      .doc("aiConfiguration")
      .set({
        mode: "client_managed",
      });

    const result = await executeAtlasAiCallable(
      {
        firestore,
        now: () => 1700000000000,
      },
      "active-user",
      request()
    );

    expect(result.reason)
      .toBe("provider_not_configured");
  });

  it("enforces a durable per-user request limit", async () => {
    await seedProfile("rate-limited-user");

    const dependencies = {
      firestore,
      now: () => 1700000000000,
    };

    for (let index = 0; index < 10; index += 1) {
      await executeAtlasAiCallable(
        dependencies,
        "rate-limited-user",
        request()
      );
    }

    await expect(
      executeAtlasAiCallable(
        dependencies,
        "rate-limited-user",
        request()
      )
    ).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });
});
