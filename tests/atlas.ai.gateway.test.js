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
    firestore.collection("atlasAiUsage"),
    firestore.collection("entities").doc("ModulePermission")
      .collection("records"),
    firestore.collection("entities").doc("UserPermissionOverride")
      .collection("records"),
    firestore.collection("entities").doc("Lead").collection("records"),
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

  await firestore.collection("entities").doc("ModulePermission")
    .collection("records").doc(`${uid}-atlas`).set({
      module_key: "atlas",
      role_key: "salesperson",
      can_view: true,
      record_scope: "own",
      active: true,
    });
}

function request(overrides = {}) {
  return {
    operation: "lead_analysis",
    input: "Analyze the assigned lead.",
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

  it("denies users without effective ATLAS access", async () => {
    await firestore.collection("userProfiles").doc("viewer").set({
      uid: "viewer",
      application_role: "viewer_support",
      account_status: "active",
    });

    await expect(
      requireAtlasAiActor(firestore, "viewer")
    ).rejects.toMatchObject({code: "permission-denied"});
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

  it("rejects untrusted raw CRM context", () => {
    expect(() => normalizeAtlasAiRequest(request({
      context: {leadId: "lead-001"},
    }))).toThrow("unsupported fields");
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

  it("executes a configured provider and records usage", async () => {
    await seedProfile("provider-user");
    await firestore.collection("system").doc("aiConfiguration").set({
      mode: "atlas_managed",
    });
    const provider = {
      execute: async () => ({
        output: {classification: "Hot"},
        provider: "test-provider",
        model: "test-model",
        inputTokens: 12,
        outputTokens: 4,
        estimatedCostUsd: 0.001,
      }),
    };
    const result = await executeAtlasAiCallable(
      {firestore, provider, now: () => 1700000000000},
      "provider-user",
      request()
    );
    expect(result).toMatchObject({
      success: true,
      status: "completed",
      output: {classification: "Hot"},
    });
    const usage = await firestore.collection("atlasAiUsage")
      .doc(result.requestId).get();
    expect(usage.data()).toMatchObject({
      user_id: "provider-user",
      provider: "test-provider",
      status: "completed",
      input_tokens: 12,
    });
  });

  it("loads only CRM records allowed by the effective scope", async () => {
    await seedProfile("scoped-user");
    await firestore.collection("system").doc("aiConfiguration").set({
      mode: "atlas_managed",
    });
    await firestore.collection("entities").doc("Lead")
      .collection("records").doc("owned-lead").set({
        owner_user_id: "scoped-user",
        full_name: "Authorized Lead",
      });
    let suppliedContext;
    const provider = {execute: async (providerRequest) => {
      suppliedContext = providerRequest.context;
      return {
        output: "ok", provider: "test", model: "test",
        inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0,
      };
    }};
    await executeAtlasAiCallable(
      {firestore, provider},
      "scoped-user",
      request({context: {
        record_refs: [{entity: "Lead", id: "owned-lead"}],
      }})
    );
    expect(suppliedContext.server_crm_context[0]).toMatchObject({
      entity: "Lead", id: "owned-lead", full_name: "Authorized Lead",
    });
  });

  it("preserves authorized CRM context during vision requests", async () => {
    await seedProfile("vision-user");
    await firestore.collection("system").doc("aiConfiguration").set({
      mode: "atlas_managed",
    });
    await firestore.collection("entities").doc("Lead")
      .collection("records").doc("vision-lead").set({
        owner_user_id: "vision-user",
        full_name: "Vision Lead",
      });
    let suppliedContext;
    const provider = {execute: async (providerRequest) => {
      suppliedContext = providerRequest.context;
      return {
        output: "ok", provider: "test", model: "test",
        inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0,
      };
    }};
    const artifacts = {
      authorizeImages: async () => [
        "data:image/png;base64,aW1hZ2U=",
      ],
    };
    await executeAtlasAiCallable(
      {firestore, provider, artifacts},
      "vision-user",
      {
        operation: "lead_import",
        input: "Read this lead image.",
        context: {
          storage_paths: [
            "users/vision-user/uploads/upload-1/lead.png",
          ],
          record_refs: [{entity: "Lead", id: "vision-lead"}],
        },
      }
    );
    expect(suppliedContext.authorized_image_data_urls).toHaveLength(1);
    expect(suppliedContext.server_crm_context[0]).toMatchObject({
      id: "vision-lead", full_name: "Vision Lead",
    });
  });

  it("denies out-of-scope CRM context", async () => {
    await seedProfile("scoped-user");
    await firestore.collection("system").doc("aiConfiguration").set({
      mode: "atlas_managed",
    });
    await firestore.collection("entities").doc("Lead")
      .collection("records").doc("other-lead").set({
        owner_user_id: "other-user",
      });
    await expect(executeAtlasAiCallable(
      {firestore, provider: {execute: async () => ({})}},
      "scoped-user",
      request({context: {
        record_refs: [{entity: "Lead", id: "other-lead"}],
      }})
    )).rejects.toMatchObject({code: "permission-denied"});
  });

  it("sanitizes provider failures and records failure usage", async () => {
    await seedProfile("failure-user");
    await firestore.collection("system").doc("aiConfiguration").set({
      mode: "atlas_managed",
    });
    await expect(executeAtlasAiCallable(
      {
        firestore,
        provider: {execute: async () => {
          throw new Error("secret provider detail");
        }},
        now: () => 1700000000000,
      },
      "failure-user",
      request()
    )).rejects.toMatchObject({
      code: "unavailable",
      message: "ATLAS could not complete the request.",
    });
    const usage = await firestore.collection("atlasAiUsage")
      .where("user_id", "==", "failure-user").get();
    expect(usage.docs[0].data().status).toBe("failed");
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
