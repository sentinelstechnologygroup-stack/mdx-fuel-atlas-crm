// functions/scripts/seed-emulators.js
/* eslint-disable @typescript-eslint/no-require-imports, require-jsdoc */
const {getApps, initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");

const PROJECT_ID = "mdx-fuel-atlas-crm-dev";
const TEST_PASSWORD = "AtlasTest!2026";

const users = [
  {
    uid: "super-admin-user",
    email: "superadmin@example.test",
    displayName: "Test Super Administrator",
    role: "super_admin",
    status: "active",
    teamId: null,
    supervisorId: null,
  },
  {
    uid: "admin-user",
    email: "admin@example.test",
    displayName: "Test Administrator",
    role: "admin",
    status: "active",
    teamId: null,
    supervisorId: null,
  },
  {
    uid: "supervisor-user",
    email: "supervisor@example.test",
    displayName: "Test Supervisor",
    role: "supervisor",
    status: "active",
    teamId: "team-alpha",
    supervisorId: null,
  },
  {
    uid: "salesperson-user",
    email: "salesperson@example.test",
    displayName: "Test Salesperson",
    role: "salesperson",
    status: "active",
    teamId: "team-alpha",
    supervisorId: "supervisor-user",
  },
  {
    uid: "viewer-support-user",
    email: "viewer@example.test",
    displayName: "Test Viewer Support",
    role: "viewer_support",
    status: "active",
    teamId: "team-support",
    supervisorId: null,
  },
  {
    uid: "inactive-user",
    email: "inactive@example.test",
    displayName: "Test Inactive User",
    role: "salesperson",
    status: "inactive",
    teamId: "team-alpha",
    supervisorId: "supervisor-user",
  },
];

function assertEmulatorSafety() {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;

  if (authHost !== "127.0.0.1:9099") {
    throw new Error(
      "Refusing to seed: FIREBASE_AUTH_EMULATOR_HOST must be 127.0.0.1:9099."
    );
  }

  if (firestoreHost !== "127.0.0.1:8080") {
    throw new Error(
      "Refusing to seed: FIRESTORE_EMULATOR_HOST must be 127.0.0.1:8080."
    );
  }
}

async function upsertAuthUser(auth, user) {
  try {
    await auth.getUser(user.uid);
    await auth.updateUser(user.uid, {
      email: user.email,
      password: TEST_PASSWORD,
      displayName: user.displayName,
      disabled: false,
      emailVerified: true,
    });
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }

    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: TEST_PASSWORD,
      displayName: user.displayName,
      disabled: false,
      emailVerified: true,
    });
  }

  await auth.setCustomUserClaims(user.uid, {
    role: user.role,
    status: user.status,
  });
}

async function main() {
  assertEmulatorSafety();

  const app = getApps().length > 0 ?
    getApps()[0] :
    initializeApp({projectId: PROJECT_ID});
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const fixedTimestamp = Timestamp.fromDate(
    new Date("2026-07-17T00:00:00.000Z")
  );

  for (const user of users) {
    await upsertAuthUser(auth, user);

    await firestore.collection("userProfiles").doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      teamId: user.teamId,
      supervisorId: user.supervisorId,
      permissionOverrides: {},
      createdAt: fixedTimestamp,
      updatedAt: fixedTimestamp,
      lastLoginAt: null,
      isDeleted: false,
    });

    console.log(`Seeded ${user.uid} (${user.role}, ${user.status})`);
  }

  console.log("");
  console.log("Firebase emulators seeded successfully.");
  console.log("Test password for all emulator accounts: AtlasTest!2026");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
