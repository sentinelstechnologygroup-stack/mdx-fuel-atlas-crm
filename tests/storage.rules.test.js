// tests/storage.rules.test.js
import { readFileSync } from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

import {
  doc,
  setDoc,
} from 'firebase/firestore';

import {
  deleteObject,
  getBytes,
  ref,
  uploadBytes,
  uploadString,
} from 'firebase/storage';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from 'vitest';

const PROJECT_ID = 'mdx-fuel-atlas-crm-dev';

const USERS = Object.freeze({
  alice: {
    uid: 'storage-alice',
    email: 'storage-alice@example.test',
    role: 'salesperson',
    status: 'active',
  },
  bob: {
    uid: 'storage-bob',
    email: 'storage-bob@example.test',
    role: 'supervisor',
    status: 'active',
  },
  admin: {
    uid: 'storage-admin',
    email: 'storage-admin@example.test',
    role: 'admin',
    status: 'active',
  },
  inactive: {
    uid: 'storage-inactive',
    email: 'storage-inactive@example.test',
    role: 'salesperson',
    status: 'inactive',
  },
});

const ALICE_UPLOAD_ID = 'alice-upload-001';
const ALICE_PATH =
  `users/${USERS.alice.uid}/uploads/${ALICE_UPLOAD_ID}/document.pdf`;

let testEnvironment;

function profileFor(user) {
  return {
    uid: user.uid,
    email: user.email,
    application_role: user.role,
    account_status: user.status,
    role: user.role,
    status: user.status,
    team_id: null,
    supervisor_user_id: null,
    territory_ids: [],
  };
}

function storageFor(user) {
  return testEnvironment
    .authenticatedContext(user.uid, {
      application_role: user.role,
      account_status: user.status,
    })
    .storage();
}

function uploadMetadata(user, uploadId, overrides = {}) {
  return {
    contentType: 'application/pdf',
    customMetadata: {
      ownerUid: user.uid,
      originalName: 'document.pdf',
      uploadedAt: '2026-08-05T22:00:00.000Z',
      uploadId,
      metadataVersion: '1',
      sanitizedName: 'document.pdf',
      ...overrides,
    },
  };
}

async function seedStoredObject(path, data, metadata) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await uploadString(
      ref(context.storage(), path),
      data,
      'raw',
      metadata
    );
  });
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: readFileSync('storage.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.clearStorage();

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();

    for (const user of Object.values(USERS)) {
      await setDoc(
        doc(database, 'userProfiles', user.uid),
        profileFor(user)
      );
    }
  });
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe('Phase 9 Firebase Storage upload authorization', () => {
  it('allows an active user to upload into their own path', async () => {
    const storage = storageFor(USERS.alice);

    await assertSucceeds(
      uploadString(
        ref(storage, ALICE_PATH),
        'valid-pdf-content',
        'raw',
        uploadMetadata(USERS.alice, ALICE_UPLOAD_ID)
      )
    );
  });

  it('denies unauthenticated uploads', async () => {
    const storage =
      testEnvironment.unauthenticatedContext().storage();

    await assertFails(
      uploadString(
        ref(storage, ALICE_PATH),
        'unauthenticated-content',
        'raw',
        uploadMetadata(USERS.alice, ALICE_UPLOAD_ID)
      )
    );
  });

  it('denies inactive users', async () => {
    const uploadId = 'inactive-upload-001';
    const path =
      `users/${USERS.inactive.uid}/uploads/${uploadId}/document.pdf`;

    await assertFails(
      uploadString(
        ref(storageFor(USERS.inactive), path),
        'inactive-content',
        'raw',
        uploadMetadata(USERS.inactive, uploadId)
      )
    );
  });

  it('denies uploads into another user path', async () => {
    await assertFails(
      uploadString(
        ref(storageFor(USERS.bob), ALICE_PATH),
        'cross-user-content',
        'raw',
        uploadMetadata(USERS.alice, ALICE_UPLOAD_ID)
      )
    );
  });

  it('denies forged owner metadata', async () => {
    await assertFails(
      uploadString(
        ref(storageFor(USERS.alice), ALICE_PATH),
        'forged-owner-content',
        'raw',
        uploadMetadata(
          USERS.alice,
          ALICE_UPLOAD_ID,
          {
            ownerUid: USERS.bob.uid,
          }
        )
      )
    );
  });

  it('denies a mismatched metadata upload ID', async () => {
    await assertFails(
      uploadString(
        ref(storageFor(USERS.alice), ALICE_PATH),
        'forged-id-content',
        'raw',
        uploadMetadata(
          USERS.alice,
          'different-upload-id'
        )
      )
    );
  });

  it('denies missing metadata versions', async () => {
    await assertFails(
      uploadString(
        ref(storageFor(USERS.alice), ALICE_PATH),
        'missing-version-content',
        'raw',
        uploadMetadata(
          USERS.alice,
          ALICE_UPLOAD_ID,
          {metadataVersion: null}
        )
      )
    );
  });

  it('denies sanitized names that differ from the object path', async () => {
    await assertFails(
      uploadString(
        ref(storageFor(USERS.alice), ALICE_PATH),
        'mismatched-name-content',
        'raw',
        uploadMetadata(
          USERS.alice,
          ALICE_UPLOAD_ID,
          {sanitizedName: 'different.pdf'}
        )
      )
    );
  });

  it('denies disallowed executable MIME types', async () => {
    const uploadId = 'bad-type-upload';
    const path =
      `users/${USERS.alice.uid}/uploads/${uploadId}/malware.exe`;

    await assertFails(
      uploadString(
        ref(storageFor(USERS.alice), path),
        'not-an-executable',
        'raw',
        {
          ...uploadMetadata(USERS.alice, uploadId),
          contentType: 'application/x-msdownload',
        }
      )
    );
  });

  it('denies files larger than 10 MB', async () => {
    const uploadId = 'oversized-upload';
    const path =
      `users/${USERS.alice.uid}/uploads/${uploadId}/large.pdf`;

    const oversizedData =
      new Uint8Array((10 * 1024 * 1024) + 1);

    await assertFails(
      uploadBytes(
        ref(storageFor(USERS.alice), path),
        oversizedData,
        uploadMetadata(USERS.alice, uploadId)
      )
    );
  });

  it('allows the owner to read their stored object', async () => {
    await seedStoredObject(
      ALICE_PATH,
      'owner-readable-content',
      uploadMetadata(USERS.alice, ALICE_UPLOAD_ID)
    );

    await assertSucceeds(
      getBytes(
        ref(storageFor(USERS.alice), ALICE_PATH)
      )
    );
  });

  it('denies another user from reading the object', async () => {
    await seedStoredObject(
      ALICE_PATH,
      'private-content',
      uploadMetadata(USERS.alice, ALICE_UPLOAD_ID)
    );

    await assertFails(
      getBytes(
        ref(storageFor(USERS.bob), ALICE_PATH)
      )
    );
  });

  it('denies administrators from bypassing file ownership', async () => {
    await seedStoredObject(
      ALICE_PATH,
      'private-content',
      uploadMetadata(USERS.alice, ALICE_UPLOAD_ID)
    );

    await assertFails(
      getBytes(
        ref(storageFor(USERS.admin), ALICE_PATH)
      )
    );
  });

  it('denies inactive owners from reading stored objects', async () => {
    const uploadId = 'inactive-existing-upload';
    const path =
      `users/${USERS.inactive.uid}/uploads/${uploadId}/document.pdf`;

    await seedStoredObject(
      path,
      'inactive-private-content',
      uploadMetadata(USERS.inactive, uploadId)
    );

    await assertFails(
      getBytes(
        ref(storageFor(USERS.inactive), path)
      )
    );
  });

  it('denies overwriting an existing object', async () => {
    await seedStoredObject(
      ALICE_PATH,
      'original-content',
      uploadMetadata(USERS.alice, ALICE_UPLOAD_ID)
    );

    await assertFails(
      uploadString(
        ref(storageFor(USERS.alice), ALICE_PATH),
        'replacement-content',
        'raw',
        uploadMetadata(USERS.alice, ALICE_UPLOAD_ID)
      )
    );
  });

  it('allows only the active owner to delete an object', async () => {
    await seedStoredObject(
      ALICE_PATH,
      'deletable-content',
      uploadMetadata(USERS.alice, ALICE_UPLOAD_ID)
    );

    await assertFails(
      deleteObject(
        ref(storageFor(USERS.bob), ALICE_PATH)
      )
    );

    await assertSucceeds(
      deleteObject(
        ref(storageFor(USERS.alice), ALICE_PATH)
      )
    );
  });
});

describe('Phase 11 generated image authorization', () => {
  const generatedPath =
    `users/${USERS.alice.uid}/generated/generation-001/atlas-output.png`;

  function generatedMetadata(overrides = {}) {
    return {
      contentType: 'image/png',
      customMetadata: {
        ownerUid: USERS.alice.uid,
        generatedBy: 'ATLAS',
        requestId: 'request-001',
        ...overrides,
      },
    };
  }

  it('allows only the active owner to read an ATLAS image', async () => {
    await seedStoredObject(
      generatedPath,
      'generated-image-content',
      generatedMetadata()
    );
    await assertSucceeds(getBytes(
      ref(storageFor(USERS.alice), generatedPath)
    ));
    await assertFails(getBytes(
      ref(storageFor(USERS.bob), generatedPath)
    ));
  });

  it('denies client creation in the generated namespace', async () => {
    await assertFails(uploadString(
      ref(storageFor(USERS.alice), generatedPath),
      'forged-generated-image',
      'raw',
      generatedMetadata()
    ));
  });

  it('denies reading an object without ATLAS provenance', async () => {
    await seedStoredObject(
      generatedPath,
      'untrusted-content',
      generatedMetadata({generatedBy: 'forged'})
    );
    await assertFails(getBytes(
      ref(storageFor(USERS.alice), generatedPath)
    ));
  });
});
