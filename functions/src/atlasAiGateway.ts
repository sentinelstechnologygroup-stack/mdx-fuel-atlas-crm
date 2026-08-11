import {createHash} from "node:crypto";

import type {Firestore} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";

type AiMode =
  | "disabled"
  | "atlas_managed"
  | "client_managed";

type AiOperation =
  | "lead_analysis"
  | "report_insights"
  | "opportunity_assistance"
  | "smart_email"
  | "activity_summary"
  | "lead_import"
  | "document_extraction"
  | "image_generation"
  | "conversation";

type DataRecord = Record<string, unknown>;

/**
 * Validated request accepted by the ATLAS AI gateway.
 */
export interface AtlasAiRequest {
  operation: AiOperation;
  input: string;
  context?: DataRecord;
}

/**
 * Controlled unavailable result returned before provider integration.
 */
export interface AtlasAiResult {
  success: false;
  status: "unavailable";
  operation: AiOperation;
  reason:
    | "ai_disabled"
    | "provider_not_configured";
  requestId: string;
}

/**
 * Server-side dependencies required by the ATLAS AI gateway.
 */
export interface AtlasAiGatewayDependencies {
  firestore: Firestore;
  now?: () => number;
}

const OPERATIONS = new Set<AiOperation>([
  "lead_analysis",
  "report_insights",
  "opportunity_assistance",
  "smart_email",
  "activity_summary",
  "lead_import",
  "document_extraction",
  "image_generation",
  "conversation",
]);

const REQUEST_KEYS = new Set([
  "operation",
  "input",
  "context",
]);

const MAX_INPUT_CHARACTERS = 12000;
const MAX_CONTEXT_BYTES = 24000;
const MAX_REQUEST_BYTES = 40000;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 10;
export const AI_PROVIDER_TIMEOUT_MS = 30000;

/**
 * Reads and normalizes a non-empty string property.
 * @param {DataRecord} record Source record.
 * @param {string} key Property name.
 * @return {string|null} Normalized string or null.
 */
function readString(
  record: DataRecord,
  key: string
): string | null {
  const value = record[key];

  return typeof value === "string" &&
    value.trim().length > 0 ?
    value.trim() :
    null;
}

/**
 * Creates a privacy-safe identifier for an AI request.
 * @param {string} uid Authenticated user identifier.
 * @param {string} operation Requested AI operation.
 * @param {number} now Current timestamp.
 * @return {string} Deterministic request identifier.
 */
function requestId(
  uid: string,
  operation: string,
  now: number
): string {
  return createHash("sha256")
    .update(uid + ":" + operation + ":" + now)
    .digest("hex")
    .slice(0, 24);
}

/**
 * Validates and normalizes an ATLAS AI request.
 * @param {unknown} value Untrusted callable request data.
 * @return {AtlasAiRequest} Validated AI request.
 */
export function normalizeAtlasAiRequest(
  value: unknown
): AtlasAiRequest {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A valid AI request is required."
    );
  }

  const record = value as DataRecord;
  const suppliedKeys = Object.keys(record);

  if (
    suppliedKeys.some((key) => !REQUEST_KEYS.has(key))
  ) {
    throw new HttpsError(
      "invalid-argument",
      "The AI request contains unsupported fields."
    );
  }

  const operation = readString(record, "operation");

  if (
    !operation ||
    !OPERATIONS.has(operation as AiOperation)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "The requested AI operation is not supported."
    );
  }

  const input = readString(record, "input");

  if (
    !input ||
    input.length > MAX_INPUT_CHARACTERS
  ) {
    throw new HttpsError(
      "invalid-argument",
      "AI input must contain between 1 and 12000 characters."
    );
  }

  let context: DataRecord | undefined;

  if (record.context !== undefined) {
    if (
      !record.context ||
      typeof record.context !== "object" ||
      Array.isArray(record.context)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "AI context must be an object."
      );
    }

    context = record.context as DataRecord;

    if (
      Buffer.byteLength(
        JSON.stringify(context),
        "utf8"
      ) > MAX_CONTEXT_BYTES
    ) {
      throw new HttpsError(
        "invalid-argument",
        "AI context exceeds the allowed size."
      );
    }
  }

  const normalized: AtlasAiRequest = {
    operation: operation as AiOperation,
    input,
    ...(context ? {context} : {}),
  };

  if (
    Buffer.byteLength(
      JSON.stringify(normalized),
      "utf8"
    ) > MAX_REQUEST_BYTES
  ) {
    throw new HttpsError(
      "invalid-argument",
      "The AI request exceeds the allowed size."
    );
  }

  return normalized;
}

/**
 * Requires an authenticated active ATLAS employee.
 * @param {Firestore} firestore Firestore service.
 * @param {string|undefined} uid Authenticated user identifier.
 * @return {Promise<{uid: string, role: string}>} Authorized actor.
 */
export async function requireAtlasAiActor(
  firestore: Firestore,
  uid: string | undefined
): Promise<{uid: string; role: string}> {
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication is required."
    );
  }

  const snapshot = await firestore
    .collection("userProfiles")
    .doc(uid)
    .get();

  if (!snapshot.exists) {
    throw new HttpsError(
      "permission-denied",
      "An active ATLAS employee profile is required."
    );
  }

  const profile = snapshot.data() || {};
  const status =
    readString(profile, "account_status") ||
    readString(profile, "accountStatus") ||
    (profile.active === false ? "inactive" : "active");

  if (status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "The ATLAS employee account is not active."
    );
  }

  const role =
    readString(profile, "application_role") ||
    readString(profile, "appRole") ||
    readString(profile, "role") ||
    "viewer_support";

  return {uid, role};
}

/**
 * Enforces the durable per-user AI request limit.
 * @param {Firestore} firestore Firestore service.
 * @param {string} uid Authenticated user identifier.
 * @param {number} now Current timestamp.
 * @return {Promise<void>} Resolves after recording the request.
 */
async function enforceRateLimit(
  firestore: Firestore,
  uid: string,
  now: number
): Promise<void> {
  const windowStart =
    Math.floor(now / RATE_LIMIT_WINDOW_MS) *
    RATE_LIMIT_WINDOW_MS;

  const identifier = createHash("sha256")
    .update(uid)
    .digest("hex")
    .slice(0, 32) +
    "-" +
    windowStart;

  const reference = firestore
    .collection("system")
    .doc("aiRateLimits")
    .collection("records")
    .doc(identifier);

  await firestore.runTransaction(
    async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.exists ?
        Number(snapshot.data()?.count || 0) :
        0;

      if (current >= RATE_LIMIT_MAX_REQUESTS) {
        throw new HttpsError(
          "resource-exhausted",
          "The AI request limit has been reached. Try again later."
        );
      }

      transaction.set(
        reference,
        {
          count: current + 1,
          window_start: windowStart,
          expires_at:
            windowStart + RATE_LIMIT_WINDOW_MS * 2,
          updated_date: new Date(now).toISOString(),
        },
        {merge: true}
      );
    }
  );
}

/**
 * Reads the server-controlled ATLAS AI operating mode.
 * @param {Firestore} firestore Firestore service.
 * @return {Promise<AiMode>} Configured safe AI mode.
 */
async function readMode(
  firestore: Firestore
): Promise<AiMode> {
  const snapshot = await firestore
    .collection("system")
    .doc("aiConfiguration")
    .get();

  if (!snapshot.exists) {
    return "disabled";
  }

  const rawMode = readString(
    snapshot.data() || {},
    "mode"
  );

  if (
    rawMode === "atlas_managed" ||
    rawMode === "client_managed"
  ) {
    return rawMode;
  }

  return "disabled";
}

/**
 * Executes the secured ATLAS AI callable gateway.
 * @param {AtlasAiGatewayDependencies} dependencies Server dependencies.
 * @param {string|undefined} uid Authenticated user identifier.
 * @param {unknown} rawRequest Untrusted callable request data.
 * @return {Promise<AtlasAiResult>} Controlled gateway result.
 */
export async function executeAtlasAiCallable(
  dependencies: AtlasAiGatewayDependencies,
  uid: string | undefined,
  rawRequest: unknown
): Promise<AtlasAiResult> {
  const actor = await requireAtlasAiActor(
    dependencies.firestore,
    uid
  );

  const request = normalizeAtlasAiRequest(rawRequest);
  const now = dependencies.now?.() ?? Date.now();
  const id = requestId(
    actor.uid,
    request.operation,
    now
  );

  await enforceRateLimit(
    dependencies.firestore,
    actor.uid,
    now
  );

  const mode = await readMode(dependencies.firestore);
  const reason = mode === "disabled" ?
    "ai_disabled" :
    "provider_not_configured";

  logger.info("ATLAS AI request safely unavailable", {
    requestId: id,
    operation: request.operation,
    mode,
    actorRole: actor.role,
    inputCharacters: request.input.length,
    contextBytes: request.context ?
      Buffer.byteLength(
        JSON.stringify(request.context),
        "utf8"
      ) :
      0,
  });

  return {
    success: false,
    status: "unavailable",
    operation: request.operation,
    reason,
    requestId: id,
  };
}
