/* eslint-disable require-jsdoc, max-len */
import {createHash, randomUUID} from "node:crypto";

import ExcelJS from "exceljs";
import type {Bucket} from "@google-cloud/storage";
import {HttpsError} from "firebase-functions/v2/https";

type JsonRecord = Record<string, unknown>;

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function storagePath(context: JsonRecord): string {
  const value = context.storage_path;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError(
      "invalid-argument", "A Firebase Storage path is required."
    );
  }
  return value.trim();
}

function requireOwnedPath(path: string, uid: string): void {
  if (!path.startsWith(`users/${uid}/uploads/`)) {
    throw new HttpsError(
      "permission-denied", "The requested file is not owned by this user."
    );
  }
}

async function ownedFile(
  bucket: Bucket, uid: string, path: string
): Promise<{buffer: Buffer; contentType: string}> {
  requireOwnedPath(path, uid);
  const file = bucket.file(path);
  const [metadata] = await file.getMetadata();
  const ownerUid = metadata.metadata?.ownerUid;
  const size = Number(metadata.size || 0);
  if (ownerUid !== uid || size <= 0 || size > MAX_ARTIFACT_BYTES) {
    throw new HttpsError("permission-denied", "The file cannot be processed.");
  }
  const [buffer] = await file.download();
  return {
    buffer,
    contentType: typeof metadata.contentType === "string" ?
      metadata.contentType : "application/octet-stream",
  };
}

export class AtlasAiArtifactService {
  constructor(private readonly bucket: Bucket) {}

  async extractDocument(uid: string, context: JsonRecord): Promise<unknown> {
    const artifact = await ownedFile(this.bucket, uid, storagePath(context));
    if (artifact.contentType === "text/csv" ||
        artifact.contentType === "text/plain") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Import");
      const rows = artifact.buffer.toString("utf8").split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => line.split(",").map((cell) => cell.trim()));
      rows.forEach((row) => worksheet.addRow(row));
      return this.rowsFromWorksheet(worksheet);
    }
    const spreadsheetTypes = new Set([
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);
    if (!spreadsheetTypes.has(artifact.contentType)) {
      throw new HttpsError(
        "invalid-argument", "Document extraction supports CSV, text, and Excel."
      );
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(artifact.buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];
    return this.rowsFromWorksheet(worksheet);
  }

  async authorizeImages(uid: string, context: JsonRecord): Promise<string[]> {
    const paths = Array.isArray(context.storage_paths) ? context.storage_paths :
      (context.storage_path ? [context.storage_path] : []);
    if (paths.length > 4) {
      throw new HttpsError("invalid-argument", "At most four images are allowed.");
    }
    const results: string[] = [];
    for (const value of paths) {
      if (typeof value !== "string") continue;
      const artifact = await ownedFile(this.bucket, uid, value);
      if (!IMAGE_TYPES.has(artifact.contentType)) {
        throw new HttpsError("invalid-argument", "Only supported images are allowed.");
      }
      results.push(
        `data:${artifact.contentType};base64,${artifact.buffer.toString("base64")}`
      );
    }
    return results;
  }

  async persistGeneratedImage(
    uid: string, requestId: string, providerOutput: unknown
  ): Promise<JsonRecord> {
    const output = providerOutput && typeof providerOutput === "object" ?
      providerOutput as JsonRecord : {};
    if (typeof output.b64_json !== "string") {
      throw new Error("Generated image payload is invalid.");
    }
    const buffer = Buffer.from(output.b64_json, "base64");
    if (buffer.length <= 0 || buffer.length > MAX_ARTIFACT_BYTES) {
      throw new Error("Generated image size is invalid.");
    }
    const id = randomUUID();
    const path = `users/${uid}/generated/${id}/atlas-${requestId}.png`;
    await this.bucket.file(path).save(buffer, {
      resumable: false,
      contentType: "image/png",
      metadata: {metadata: {
        ownerUid: uid, generatedBy: "ATLAS", requestId,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      }},
    });
    return {storage_path: path, content_type: "image/png", size: buffer.length};
  }

  private rowsFromWorksheet(worksheet: ExcelJS.Worksheet): JsonRecord[] {
    const rows = worksheet.getSheetValues().slice(1) as unknown[][];
    if (rows.length === 0) return [];
    const headers = (rows[0] || []).slice(1).map(
      (value, index) => String(value || `column_${index + 1}`).trim()
    );
    return rows.slice(1).filter((row) => Array.isArray(row)).map((row) =>
      Object.fromEntries(headers.map((header, index) => [
        header, (row as unknown[])[index + 1] ?? null,
      ]))
    );
  }
}
