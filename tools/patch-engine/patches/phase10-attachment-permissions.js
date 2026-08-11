export default {
  id: 'phase10-attachment-permissions',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore', 'functions/src/automation.ts', 'functions/src/index.ts',
    'functions/src/notificationDeliveryBridge.ts', 'package.json',
    'src/components/common/FileUpload.jsx',
    'src/components/cs/ClientDetails.jsx',
    'src/firebase/attachmentMetadata.js',
    'src/firebase/storageService.js',
    'tests/attachment.metadata.test.js',
    'tests/automation.messaging.test.js',
    'tests/functions.automationTrigger.emulator.test.js',
    'tests/notification.delivery.bridge.test.js',
  ],
  files: [
    {
      path: 'src/firebase/attachmentMetadata.js',
      operations: [
        {
          type: 'replace',
          anchor: '  fileUrl,\n',
          content: '',
        },
        {
          type: 'delete',
          anchor: "    url: requiredString(fileUrl, 'download URL'),\n",
        },
        {
          type: 'insertBefore',
          anchor: 'export function buildAttachmentRecord({\n',
          content: `
export function attachmentAccessTarget(attachment = {}) {
  const name = requiredString(
    attachment.name || 'attachment',
    'original name'
  ).slice(0, 512);

  if (
    typeof attachment.storage_path === 'string' &&
    attachment.storage_path.trim()
  ) {
    return Object.freeze({
      kind: 'firebase-storage',
      value: attachment.storage_path.trim(),
      name,
    });
  }

  if (
    attachment.metadata_version === undefined &&
    typeof attachment.url === 'string' &&
    /^https:\/\//i.test(attachment.url.trim())
  ) {
    return Object.freeze({
      kind: 'legacy-url',
      value: attachment.url.trim(),
      name,
    });
  }

  throw new Error('Attachment has no permitted access target.');
}
`,
        },
      ],
    },
    {
      path: 'src/firebase/storageService.js',
      operations: [
        {
          type: 'insertAfter',
          anchor: '  getDownloadURL,\n',
          content: '  getBlob,\n',
        },
        {
          type: 'replace',
          anchor: "import { buildAttachmentRecord } from '@/firebase/attachmentMetadata';\n",
          content: "import {\n  attachmentAccessTarget,\n  buildAttachmentRecord,\n} from '@/firebase/attachmentMetadata';\n",
        },
        {
          type: 'delete',
          anchor: '    fileUrl: downloadUrl,\n',
        },
        {
          type: 'insertBefore',
          anchor: 'export async function uploadFileToFirebase({ file } = {}) {\n',
          content: `function triggerBrowserDownload(url, name, openInNewTab = false) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;

  if (openInNewTab) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function downloadAttachmentFromFirebase(attachment) {
  requireAuthenticatedUser();

  const target = attachmentAccessTarget(attachment);

  if (target.kind === 'legacy-url') {
    triggerBrowserDownload(target.value, target.name, true);
    return;
  }

  const storageReference = ref(firebaseStorage, target.value);
  const blob = await getBlob(storageReference, MAX_UPLOAD_BYTES);
  const objectUrl = URL.createObjectURL(blob);

  try {
    triggerBrowserDownload(objectUrl, target.name);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

`,
        },
      ],
    },
    {
      path: 'src/components/common/FileUpload.jsx',
      operations: [
        {
          type: 'replace',
          anchor: 'import { uploadFileToFirebase } from "@/firebase/storageService";\n',
          content: 'import {\n  downloadAttachmentFromFirebase,\n  uploadFileToFirebase,\n} from "@/firebase/storageService";\n',
        },
        {
          type: 'insertBefore',
          anchor: '  const removeFile = (index) => {\n',
          content: `  const downloadFile = async (file) => {
    try {
      await downloadAttachmentFromFirebase(file);
    } catch (error) {
      console.error("Download failed:", error);
      alert("You do not have permission to download this file.");
    }
  };

`,
        },
        {
          type: 'replace',
          anchor: '              <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-700 dark:text-slate-300 truncate hover:underline hover:text-blue-600">\n                {file.name}\n              </a>\n',
          content: '              <button type="button" onClick={() => downloadFile(file)} className="text-sm text-left text-slate-700 dark:text-slate-300 truncate hover:underline hover:text-blue-600">\n                {file.name}\n              </button>\n',
        },
      ],
    },
    {
      path: 'src/components/cs/ClientDetails.jsx',
      operations: [
        {
          type: 'replace',
          anchor: 'import { uploadFileToFirebase } from "@/firebase/storageService";\n',
          content: 'import {\n  downloadAttachmentFromFirebase,\n  uploadFileToFirebase,\n} from "@/firebase/storageService";\n',
        },
        {
          type: 'insertBefore',
          anchor: '  if (!client) return null;\n',
          content: `  const handleDocumentDownload = async (documentRecord) => {
    try {
      await downloadAttachmentFromFirebase(documentRecord);
    } catch (error) {
      console.error(error);
      alert("You do not have permission to download this file.");
    }
  };

`,
        },
        {
          type: 'replace',
          anchor: '                                        <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">\n                                            <Download className="w-4 h-4" />\n                                        </a>\n',
          content: '                                        <button type="button" onClick={() => handleDocumentDownload(doc)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">\n                                            <Download className="w-4 h-4" />\n                                        </button>\n',
        },
      ],
    },
    {
      path: 'storage.rules',
      operations: [{
        type: 'replace',
        anchor: '      return request.resource.metadata.ownerUid == userId &&\n        request.resource.metadata.uploadId == uploadId &&\n        request.resource.metadata.originalName != null &&\n        request.resource.metadata.uploadedAt != null;\n',
        content: "      return request.resource.metadata.ownerUid == userId &&\n        request.resource.metadata.uploadId == uploadId &&\n        request.resource.metadata.metadataVersion == '1' &&\n        request.resource.metadata.sanitizedName == fileName &&\n        request.resource.metadata.originalName is string &&\n        request.resource.metadata.originalName.size() > 0 &&\n        request.resource.metadata.originalName.size() <= 512 &&\n        request.resource.metadata.uploadedAt is string &&\n        request.resource.metadata.uploadedAt.size() > 0;\n",
      }, {
        type: 'replace',
        anchor: '    function validUploadMetadata(userId, uploadId) {\n',
        content: '    function validUploadMetadata(userId, uploadId, fileName) {\n',
      }, {
        type: 'replace',
        anchor: '        validUploadMetadata(userId, uploadId);\n',
        content: '        validUploadMetadata(userId, uploadId, fileName);\n',
      }],
    },
    {
      path: 'tests/storage.rules.test.js',
      operations: [
        {
          type: 'insertAfter',
          anchor: "      uploadId,\n",
          content: "      metadataVersion: '1',\n      sanitizedName: 'document.pdf',\n",
        },
        {
          type: 'insertBefore',
          anchor: "  it('denies disallowed executable MIME types', async () => {\n",
          content: `  it('denies missing metadata versions', async () => {
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

`,
        },
      ],
    },
    {
      path: 'tests/attachment.metadata.test.js',
      operations: [
        {type: 'delete', anchor: "  fileUrl: 'https://storage.example.test/download/token',\n"},
        {type: 'delete', anchor: '      url: input.fileUrl,\n'},
        {
          type: 'insertAfter',
          anchor: "  buildAttachmentRecord,\n",
          content: '  attachmentAccessTarget,\n',
        },
        {
          type: 'insertBefore',
          anchor: "  it.each([\n",
          content: `  it('uses authenticated Storage paths for versioned records', () => {
    const record = buildAttachmentRecord(input);

    expect(attachmentAccessTarget(record)).toEqual({
      kind: 'firebase-storage',
      value: input.storagePath,
      name: input.originalName,
    });
    expect(record).not.toHaveProperty('url');
  });

  it('supports HTTPS-only historical URL records', () => {
    expect(attachmentAccessTarget({
      name: 'Legacy.pdf',
      url: 'https://storage.example.test/legacy-token',
    }).kind).toBe('legacy-url');

    expect(() => attachmentAccessTarget({
      name: 'Unsafe.pdf',
      url: 'http://storage.example.test/token',
    })).toThrow(/access target/);
  });

`,
        },
      ],
    },
  ],
};
