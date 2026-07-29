import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

const PROJECT_ID = "mdx-fuel-atlas-crm-dev";
const PASSWORD = "AtlasTest!2026";

vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000,
});

let clientNumber = 0;
const testApps = [];

async function createCallable(email = null) {
  clientNumber += 1;

  const app = initializeApp(
    {
      apiKey: "phase6-effective-permissions-key",
      projectId: PROJECT_ID,
    },
    `phase6-effective-permissions-${clientNumber}`,
  );

  testApps.push(app);

  const auth = getAuth(app);
  const functions = getFunctions(app);

  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });

  connectFunctionsEmulator(functions, "127.0.0.1", 5001);

  if (email) {
    await signInWithEmailAndPassword(auth, email, PASSWORD);
  }

  return httpsCallable(functions, "getEffectivePermissions");
}

afterEach(async () => {
  const apps = testApps.splice(0);

  await Promise.all(apps.map((app) => deleteApp(app)));
});

describe.sequential("getEffectivePermissions Firebase callable", () => {
  it("denies anonymous callers", async () => {
    const callable = await createCallable();

    await expect(callable({})).rejects.toMatchObject({
      code: "functions/unauthenticated",
    });
  });

  it("denies inactive callers", async () => {
    const callable = await createCallable("inactive@example.test");

    await expect(callable({})).rejects.toMatchObject({
      code: "functions/permission-denied",
    });
  });

  it("returns the current user permissions", async () => {
    const callable = await createCallable("salesperson@example.test");

    const response = await callable({});

    expect(response.data.user_id).toBe("salesperson-user");
    expect(response.data.role_key).toBe("salesperson");
    expect(response.data.permissions.leads).toMatchObject({
      module_key: "leads",
    });
  });

  it("protects all super administrator actions", async () => {
    const callable = await createCallable("superadmin@example.test");

    const response = await callable({});
    const permissions = Object.values(response.data.permissions);

    expect(permissions.length).toBeGreaterThan(0);

    for (const permission of permissions) {
      expect(permission.record_scope).toBe("all");
      expect(permission.source).toBe("protected_super_admin");
      expect(permission.can_view).toBe(true);
      expect(permission.can_create).toBe(true);
      expect(permission.can_edit).toBe(true);
      expect(permission.can_delete).toBe(true);
    }
  });

  it("allows administrators to inspect salespeople", async () => {
    const callable = await createCallable("admin@example.test");

    const response = await callable({
      target_user_id: "salesperson-user",
    });

    expect(response.data.user_id).toBe("salesperson-user");
    expect(response.data.role_key).toBe("salesperson");
  });

  it("blocks salespeople from inspecting others", async () => {
    const callable = await createCallable("salesperson@example.test");

    await expect(
      callable({
        target_user_id: "viewer-support-user",
      }),
    ).rejects.toMatchObject({
      code: "functions/permission-denied",
    });
  });

  it("blocks administrators from inspecting super admins", async () => {
    const callable = await createCallable("admin@example.test");

    await expect(
      callable({
        target_user_id: "super-admin-user",
      }),
    ).rejects.toMatchObject({
      code: "functions/permission-denied",
    });
  });
});
