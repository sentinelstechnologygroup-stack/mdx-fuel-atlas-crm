/* eslint-disable @typescript-eslint/no-require-imports, require-jsdoc */
const fs = require("node:fs/promises");
const path = require("node:path");

const {getApps, initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");

const ALLOWED_PROJECTS = new Set([
  "mdx-fuel-atlas-crm-dev",
  "mdx-fuel-atlas-crm-staging",
  "mdx-fuel-atlas-crm-prod",
]);

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function refuseEmulators() {
  const emulatorVariables = [
    "FIREBASE_AUTH_EMULATOR_HOST",
    "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST",
  ];
  const configured = emulatorVariables.filter((name) => process.env[name]);
  if (configured.length > 0) {
    throw new Error(
      "Refusing production reconciliation with emulator variables: " +
      `${configured.join(", ")}.`
    );
  }
}

async function countQuery(query) {
  const snapshot = await query.count().get();
  return snapshot.data().count;
}

async function listAuthUserIds(auth) {
  const ids = new Set();
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    page.users.forEach((user) => ids.add(user.uid));
    pageToken = page.pageToken;
  } while (pageToken);
  return ids;
}

async function countStorageObjects(bucket) {
  let count = 0;
  let pageToken;
  do {
    const [files, , response] = await bucket.getFiles({
      autoPaginate: false,
      maxResults: 1000,
      pageToken,
    });
    count += files.length;
    pageToken = response && response.nextPageToken;
  } while (pageToken);
  return count;
}

async function entityCounts(firestore) {
  const result = {};
  const entityReferences = await firestore
    .collection("entities")
    .listDocuments();
  for (const entityReference of entityReferences) {
    result[entityReference.id] = await countQuery(
      entityReference.collection("records")
    );
  }
  return result;
}

async function main() {
  refuseEmulators();
  const projectId = argument("--project");
  const bucketName = argument("--bucket");
  const output = argument("--output");
  const execute = process.argv.includes("--execute");

  if (!ALLOWED_PROJECTS.has(projectId)) {
    throw new Error(
      "--project must name an approved Atlas dev, staging, or prod project."
    );
  }
  if (!bucketName || !output) {
    throw new Error("--bucket and --output are required.");
  }

  console.log(`Project: ${projectId}`);
  console.log(`Storage bucket: ${bucketName}`);
  console.log(`Evidence output: ${output}`);
  if (!execute) {
    console.log(
      "Dry run only. Add --execute to perform read-only cloud reconciliation."
    );
    return;
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp({
    projectId,
    storageBucket: bucketName,
  });
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const bucket = getStorage(app).bucket(bucketName);

  const [authIds, profileSnapshot, entities, objectCount] = await Promise.all([
    listAuthUserIds(auth),
    firestore.collection("userProfiles").select().get(),
    entityCounts(firestore),
    countStorageObjects(bucket),
  ]);
  const profileIds = new Set(
    profileSnapshot.docs.map((document) => document.id)
  );
  const unmatchedAuthUsers = [...authIds]
    .filter((id) => !profileIds.has(id)).length;
  const unmatchedProfiles = [...profileIds]
    .filter((id) => !authIds.has(id)).length;
  const evidence = {
    projectId,
    capturedAt: new Date().toISOString(),
    firestore: {
      userProfiles: profileIds.size,
      entities,
    },
    authentication: {
      snapshotComplete: true,
      userCount: authIds.size,
      profileCount: profileIds.size,
      unmatchedAuthUsers,
      unmatchedProfiles,
    },
    storage: {
      snapshotComplete: true,
      bucket: bucketName,
      objectCount,
    },
  };

  await fs.mkdir(path.dirname(output), {recursive: true});
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(output, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  if (existing.projectId && existing.projectId !== projectId) {
    throw new Error("Existing evidence belongs to a different project.");
  }
  const mergedEvidence = {
    ...existing,
    ...evidence,
    firestoreExport: existing.firestoreExport,
  };
  await fs.writeFile(
    output,
    `${JSON.stringify(mergedEvidence, null, 2)}\n`,
    "utf8"
  );
  console.log(
    "Reconciliation evidence written without record contents " +
    "or user identifiers."
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
