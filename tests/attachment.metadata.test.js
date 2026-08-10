import {describe, expect, it} from 'vitest';
import {
  ATTACHMENT_METADATA_VERSION,
  buildAttachmentRecord,
  attachmentAccessTarget,
} from '../src/firebase/attachmentMetadata.js';

const input = {
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

  it('uses authenticated Storage paths for versioned records', () => {
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
