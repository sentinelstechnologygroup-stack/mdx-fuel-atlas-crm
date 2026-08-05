import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';

import {
  firebaseAuth,
  firebaseStorage,
} from '@/firebase/client';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function requireAuthenticatedUser() {
  const currentUser = firebaseAuth.currentUser;

  if (!currentUser) {
    throw new Error('You must be signed in to upload files.');
  }

  return currentUser;
}

function validateUploadFile(file) {
  if (!(file instanceof File)) {
    throw new TypeError('A browser File object is required.');
  }

  if (file.size <= 0) {
    throw new Error('The selected file is empty.');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Files may not exceed 10 MB.');
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      `File type "${file.type || 'unknown'}" is not permitted.`
    );
  }
}

function sanitizeFileName(fileName) {
  const normalized = String(fileName || 'upload')
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');

  return normalized || 'upload';
}

function createUploadId() {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function uploadFileToFirebase({ file } = {}) {
  const currentUser = requireAuthenticatedUser();

  validateUploadFile(file);

  const uploadId = createUploadId();
  const safeFileName = sanitizeFileName(file.name);
  const storagePath =
    `users/${currentUser.uid}/uploads/${uploadId}/${safeFileName}`;

  const storageReference = ref(firebaseStorage, storagePath);
  const uploadedAt = new Date().toISOString();

  const snapshot = await uploadBytes(storageReference, file, {
    contentType: file.type,
    customMetadata: {
      ownerUid: currentUser.uid,
      originalName: file.name,
      uploadedAt,
      uploadId,
    },
  });

  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    file_url: downloadUrl,
    storage_path: snapshot.ref.fullPath,
    name: file.name,
    type: file.type,
    size: file.size,
    owner_uid: currentUser.uid,
    uploaded_at: uploadedAt,
    provider: 'firebase-storage',
  };
}
