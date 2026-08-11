export default {
  id: 'phase10-attachment-metadata',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore', 'functions/src/automation.ts', 'functions/src/index.ts',
    'functions/src/notificationDeliveryBridge.ts', 'package.json',
    'tests/automation.messaging.test.js',
    'tests/functions.automationTrigger.emulator.test.js',
    'tests/notification.delivery.bridge.test.js',
  ],
  files: [
    {
      path: 'src/firebase/attachmentMetadata.js',
      create: true,
      content: `export const ATTACHMENT_METADATA_VERSION = 1;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(\`Attachment \${field} is required.\`);
  }

  return value.trim();
}

export function buildAttachmentRecord({
  fileUrl,
  storagePath,
  originalName,
  contentType,
  size,
  ownerUid,
  uploadedAt,
  uploadId,
} = {}) {
  const normalizedOwnerUid = requiredString(ownerUid, 'owner UID');
  const normalizedUploadId = requiredString(uploadId, 'upload ID');
  const normalizedPath = requiredString(storagePath, 'storage path');
  const expectedPrefix =
    \`users/\${normalizedOwnerUid}/uploads/\${normalizedUploadId}/\`;

  if (
    !normalizedPath.startsWith(expectedPrefix) ||
    normalizedPath.length === expectedPrefix.length
  ) {
    throw new Error(
      'Attachment storage path does not match its owner and upload ID.'
    );
  }

  const normalizedSize = Number(size);

  if (
    !Number.isSafeInteger(normalizedSize) ||
    normalizedSize <= 0 ||
    normalizedSize > MAX_UPLOAD_BYTES
  ) {
    throw new Error('Attachment size is invalid.');
  }

  const normalizedUploadedAt = requiredString(
    uploadedAt,
    'upload timestamp'
  );

  if (Number.isNaN(Date.parse(normalizedUploadedAt))) {
    throw new Error('Attachment upload timestamp is invalid.');
  }

  return Object.freeze({
    metadata_version: ATTACHMENT_METADATA_VERSION,
    upload_id: normalizedUploadId,
    name: requiredString(originalName, 'original name').slice(0, 512),
    url: requiredString(fileUrl, 'download URL'),
    storage_path: normalizedPath,
    type: requiredString(contentType, 'content type'),
    size: normalizedSize,
    owner_uid: normalizedOwnerUid,
    uploaded_at: normalizedUploadedAt,
    provider: 'firebase-storage',
  });
}
`,
    },
    {
      path: 'src/firebase/storageService.js',
      operations: [
        {
          type: 'insertAfter',
          anchor: "} from '@/firebase/client';\n",
          content: "\nimport { buildAttachmentRecord } from '@/firebase/attachmentMetadata';\n",
        },
        {
          type: 'insertAfter',
          anchor: '      uploadId,\n',
          content: "      metadataVersion: '1',\n      sanitizedName: safeFileName,\n",
        },
        {
          type: 'replace',
          anchor: "  return {\n    file_url: downloadUrl,\n    storage_path: snapshot.ref.fullPath,\n    name: file.name,\n    type: file.type,\n    size: file.size,\n    owner_uid: currentUser.uid,\n    uploaded_at: uploadedAt,\n    provider: 'firebase-storage',\n  };\n",
          content: "  const attachment = buildAttachmentRecord({\n    fileUrl: downloadUrl,\n    storagePath: snapshot.ref.fullPath,\n    originalName:\n      snapshot.metadata.customMetadata?.originalName || file.name,\n    contentType: snapshot.metadata.contentType,\n    size: snapshot.metadata.size,\n    ownerUid:\n      snapshot.metadata.customMetadata?.ownerUid || currentUser.uid,\n    uploadedAt:\n      snapshot.metadata.customMetadata?.uploadedAt || uploadedAt,\n    uploadId:\n      snapshot.metadata.customMetadata?.uploadId || uploadId,\n  });\n\n  return {\n    ...attachment,\n    file_url: attachment.url,\n    attachment,\n  };\n",
        },
      ],
    },
    {
      path: 'src/components/common/FileUpload.jsx',
      operations: [{
        type: 'replace',
        anchor: "        if (response && response.file_url) {\n          newFiles.push({\n            name: file.name,\n            url: response.file_url,\n            type: file.type\n          });\n        }\n",
        content: "        if (response?.attachment) {\n          newFiles.push(response.attachment);\n        }\n",
      }],
    },
    {
      path: 'src/components/cs/ClientDetails.jsx',
      operations: [{
        type: 'replace',
        anchor: "      const { file_url } = await uploadFileToFirebase({ file });\n      const newDoc = { name: file.name, url: file_url, type: file.type };\n      const updatedDocs = [...(activeClient.documents || []), newDoc];\n",
        content: "      const upload = await uploadFileToFirebase({ file });\n      const updatedDocs = [\n        ...(activeClient.documents || []),\n        upload.attachment,\n      ];\n",
      }],
    },
    {
      path: 'tests/attachment.metadata.test.js',
      create: true,
      content: `import {describe, expect, it} from 'vitest';
import {
  ATTACHMENT_METADATA_VERSION,
  buildAttachmentRecord,
} from '../src/firebase/attachmentMetadata.js';

const input = {
  fileUrl: 'https://storage.example.test/download/token',
  storagePath:
    'users/user-1/uploads/upload-1/delivery-plan.pdf',
  originalName: 'Delivery Plan.pdf',
  contentType: 'application/pdf',
  size: '4096',
  ownerUid: 'user-1',
  uploadedAt: '2026-08-10T20:00:00.000Z',
  uploadId: 'upload-1',
};

describe('Phase 10 attachment metadata', () => {
  it('builds a complete versioned attachment record', () => {
    expect(buildAttachmentRecord(input)).toEqual({
      metadata_version: ATTACHMENT_METADATA_VERSION,
      upload_id: 'upload-1',
      name: 'Delivery Plan.pdf',
      url: input.fileUrl,
      storage_path: input.storagePath,
      type: 'application/pdf',
      size: 4096,
      owner_uid: 'user-1',
      uploaded_at: input.uploadedAt,
      provider: 'firebase-storage',
    });
  });

  it('returns an immutable metadata record', () => {
    expect(Object.isFrozen(buildAttachmentRecord(input))).toBe(true);
  });

  it.each([
    [{storagePath: 'users/other/uploads/upload-1/file.pdf'}, /storage path/],
    [{storagePath: 'users/user-1/uploads/other/file.pdf'}, /storage path/],
    [{size: 0}, /size/],
    [{size: (10 * 1024 * 1024) + 1}, /size/],
    [{uploadedAt: 'not-a-date'}, /timestamp/],
    [{contentType: ''}, /content type/],
  ])('rejects inconsistent or incomplete metadata', (overrides, error) => {
    expect(() => buildAttachmentRecord({...input, ...overrides}))
      .toThrow(error);
  });
});
`,
    },
    {
      path: 'package.json',
      operations: [{
        type: 'insertAfter',
        anchor: '    "test:automation:messaging": "vitest run --no-file-parallelism tests/automation.messaging.test.js",\n',
        content: '    "test:attachment:metadata": "vitest run --no-file-parallelism tests/attachment.metadata.test.js",\n',
      }],
    },
  ],
};
