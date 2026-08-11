import {describe, expect, it, vi} from "vitest";

import {AtlasAiArtifactService} from "../functions/src/atlasAiArtifacts.ts";

function fakeBucket({
  contentType = "text/csv",
  data = "name,email\nPat,pat@example.test",
  ownerUid = "user-1",
} = {}) {
  const save = vi.fn(async () => undefined);
  return {
    save,
    bucket: {
      file: vi.fn(() => ({
        getMetadata: async () => [{
          contentType,
          size: Buffer.byteLength(data),
          metadata: {ownerUid},
        }],
        download: async () => [Buffer.from(data)],
        save,
      })),
    },
  };
}

describe("Phase 11 ATLAS artifact service", () => {
  it("extracts an owned CSV without sending it to an AI provider", async () => {
    const {bucket} = fakeBucket();
    const service = new AtlasAiArtifactService(bucket);
    await expect(service.extractDocument("user-1", {
      storage_path: "users/user-1/uploads/upload-1/leads.csv",
    })).resolves.toEqual([{name: "Pat", email: "pat@example.test"}]);
  });

  it("denies another user's artifact path", async () => {
    const {bucket} = fakeBucket({ownerUid: "user-2"});
    const service = new AtlasAiArtifactService(bucket);
    await expect(service.extractDocument("user-1", {
      storage_path: "users/user-2/uploads/upload-1/leads.csv",
    })).rejects.toMatchObject({code: "permission-denied"});
  });

  it("accepts only supported image media for vision", async () => {
    const {bucket} = fakeBucket({contentType: "application/pdf"});
    const service = new AtlasAiArtifactService(bucket);
    await expect(service.authorizeImages("user-1", {
      storage_paths: ["users/user-1/uploads/upload-1/file.pdf"],
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("persists generated images with ATLAS provenance", async () => {
    const {bucket, save} = fakeBucket();
    const service = new AtlasAiArtifactService(bucket);
    const result = await service.persistGeneratedImage(
      "user-1", "request-1", {b64_json: "aW1hZ2U="}
    );
    expect(result.storage_path).toContain("users/user-1/generated/");
    expect(save).toHaveBeenCalledWith(
      Buffer.from("image"),
      expect.objectContaining({contentType: "image/png"})
    );
  });
});
