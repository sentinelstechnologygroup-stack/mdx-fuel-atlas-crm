import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  deleteApp,
  initializeApp,
} from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  getDocs,
  getFirestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

const PROJECT_ID = "mdx-fuel-atlas-crm-dev";
const PASSWORD = "AtlasTest!2026";

const SYSTEM_ROLES = [
  "super_admin",
  "administrator",
  "supervisor",
  "salesperson",
  "viewer_support",
];

const MODULE_KEYS = [
  "dashboard",
  "leads",
  "opportunities",
  "tasks",
  "activities",
  "clients",
  "reports",
  "automations",
  "sales_galaxy",
  "atlas",
  "marketing_sequences",
  "marketing_templates",
  "customer_success",
  "imports",
  "exports",
  "duplicate_management",
  "users",
  "teams",
  "territories",
  "roles_permissions",
  "pipeline_configuration",
  "custom_fields",
  "system_tags",
  "workflow_configuration",
  "organization_settings",
  "audit_logs",
  "integrations",
  "security_settings",
];

vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000,
});

let clientNumber = 0;
const testApps = [];

async function createClient(email = null) {
  clientNumber += 1;

  const app = initializeApp(
    {
      apiKey: "phase6-initialize-permissions-key",
      projectId: PROJECT_ID,
    },
    `phase6-initialize-permissions-${clientNumber}`,
  );

  testApps.push(app);

  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app);

  connectAuthEmulator(
    auth,
    "http://127.0.0.1:9099",
    {
      disableWarnings: true,
    },
  );

  connectFirestoreEmulator(
    firestore,
    "127.0.0.1",
    8080,
  );

  connectFunctionsEmulator(
    functions,
    "127.0.0.1",
    5001,
  );

  if (email) {
    await signInWithEmailAndPassword(
      auth,
      email,
      PASSWORD,
    );
  }

  return {
    firestore,
    initializePermissionModel: httpsCallable(
      functions,
      "initializePermissionModel",
    ),
  };
}

afterEach(async () => {
  const apps = testApps.splice(0);

  await Promise.all(
    apps.map((app) => deleteApp(app)),
  );
});

describe.sequential(
  "initializePermissionModel Firebase callable",
  () => {
    it("denies anonymous callers", async () => {
      const client = await createClient();

      await expect(
        client.initializePermissionModel({}),
      ).rejects.toMatchObject({
        code: "functions/unauthenticated",
      });
    });

    it("denies inactive callers", async () => {
      const client = await createClient(
        "inactive@example.test",
      );

      await expect(
        client.initializePermissionModel({}),
      ).rejects.toMatchObject({
        code: "functions/permission-denied",
      });
    });

    it("denies non-administrator callers", async () => {
      const client = await createClient(
        "salesperson@example.test",
      );

      await expect(
        client.initializePermissionModel({}),
      ).rejects.toMatchObject({
        code: "functions/permission-denied",
      });
    });

    it("seeds the complete permission model idempotently", async () => {
      const client = await createClient(
        "admin@example.test",
      );

      const firstResponse =
        await client.initializePermissionModel({});

      expect(firstResponse.data).toMatchObject({
        status: "initialized",
        system_roles: SYSTEM_ROLES,
        active_modules: MODULE_KEYS.length,
      });

      expect(
        firstResponse.data.roles_created,
      ).toBeGreaterThanOrEqual(0);
      expect(
        firstResponse.data.permissions_created,
      ).toBeGreaterThanOrEqual(0);

      const roleSnapshot = await getDocs(
        collection(
          client.firestore,
          "entities",
          "RoleDefinition",
          "records",
        ),
      );

      const activeRoles = roleSnapshot.docs
        .map((document) => document.data())
        .filter((role) => role.status === "active");

      for (const roleKey of SYSTEM_ROLES) {
        expect(
          activeRoles.some(
            (role) => role.role_key === roleKey,
          ),
        ).toBe(true);
      }

      const permissionSnapshot = await getDocs(
        collection(
          client.firestore,
          "entities",
          "ModulePermission",
          "records",
        ),
      );

      const activePermissionKeys = new Set(
        permissionSnapshot.docs
          .map((document) => document.data())
          .filter(
            (permission) =>
              permission.status === "active",
          )
          .map(
            (permission) =>
              permission.role_key +
              "|" +
              permission.module_key,
          ),
      );

      for (const roleKey of SYSTEM_ROLES) {
        for (const moduleKey of MODULE_KEYS) {
          expect(
            activePermissionKeys.has(
              roleKey + "|" + moduleKey,
            ),
          ).toBe(true);
        }
      }

      const secondResponse =
        await client.initializePermissionModel({});

      expect(secondResponse.data).toMatchObject({
        status: "initialized",
        roles_created: 0,
        permissions_created: 0,
        system_roles: SYSTEM_ROLES,
        active_modules: MODULE_KEYS.length,
      });
    });
  },
);
