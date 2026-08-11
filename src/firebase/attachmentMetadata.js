export const ATTACHMENT_METADATA_VERSION = 1;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Attachment ${field} is required.`);
  }

  return value.trim();
}


function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

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
    isHttpsUrl(attachment.url.trim())
  ) {
    return Object.freeze({
      kind: 'legacy-url',
      value: attachment.url.trim(),
      name,
    });
  }

  throw new Error('Attachment has no permitted access target.');
}
export function buildAttachmentRecord({
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
    `users/${normalizedOwnerUid}/uploads/${normalizedUploadId}/`;

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
    storage_path: normalizedPath,
    type: requiredString(contentType, 'content type'),
    size: normalizedSize,
    owner_uid: normalizedOwnerUid,
    uploaded_at: normalizedUploadedAt,
    provider: 'firebase-storage',
  });
}
