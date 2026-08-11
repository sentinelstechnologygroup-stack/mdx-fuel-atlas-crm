/* eslint-disable require-jsdoc, max-len */
import {createHash, randomUUID} from "node:crypto";

import type {Firestore} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import type {AtlasAiArtifactService} from "./atlasAiArtifacts.js";
import type {
  AtlasAiProvider,
  AtlasProviderResult,
} from "./atlasAiProvider.js";

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
  success: boolean;
  status: "completed" | "unavailable";
  operation: AiOperation;
  reason?:
    | "ai_disabled"
    | "provider_not_configured";
  output?: unknown;
  requestId: string;
}

/**
 * Server-side dependencies required by the ATLAS AI gateway.
 */
export interface AtlasAiGatewayDependencies {
  firestore: Firestore;
  now?: () => number;
  provider?: AtlasAiProvider;
  artifacts?: AtlasAiArtifactService;
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
const CONTEXT_KEYS = new Set([
  "response_json_schema", "json_schema", "storage_path", "storage_paths",
  "history", "record_refs",
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
    .update(":" + randomUUID())
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

    if (Object.keys(context).some((key) => !CONTEXT_KEYS.has(key))) {
      throw new HttpsError(
        "invalid-argument", "AI context contains unsupported fields."
      );
    }

    validateSchema(context.response_json_schema ?? context.json_schema);

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

function validateSchema(value: unknown, depth = 0): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 8) {
    throw new HttpsError("invalid-argument", "The response schema is invalid.");
  }
  const schema = value as DataRecord;
  if (Object.keys(schema).some((key) => key === "$ref" || key === "$defs")) {
    throw new HttpsError("invalid-argument", "Schema references are not allowed.");
  }
  if (schema.properties && typeof schema.properties === "object" &&
      !Array.isArray(schema.properties)) {
    for (const child of Object.values(schema.properties as DataRecord)) {
      validateSchema(child, depth + 1);
    }
  }
  if (schema.items !== undefined) validateSchema(schema.items, depth + 1);
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
): Promise<{uid: string; role: string; scope: string; teamId: string | null}> {
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

  const scope = await requireAtlasPermission(firestore, uid, role, profile);
  return {
    uid, role, scope,
    teamId: readString(profile, "team_id") || readString(profile, "teamId"),
  };
}

async function requireAtlasPermission(
  firestore: Firestore,
  uid: string,
  role: string,
  profile: DataRecord
): Promise<string> {
  if (role === "super_admin") return "all";
  const [moduleSnapshot, overrideSnapshot] = await Promise.all([
    firestore.collection("entities").doc("ModulePermission")
      .collection("records").get(),
    firestore.collection("entities").doc("UserPermissionOverride")
      .collection("records").get(),
  ]);
  const customRoleId = readString(profile, "custom_role_id");
  const active = (data: DataRecord): boolean => data.active !== false &&
    data.is_active !== false;
  const moduleRecords = moduleSnapshot.docs.map((doc) => doc.data())
    .filter((data) => active(data) && readString(data, "module_key") === "atlas");
  const base = moduleRecords.find((data) => customRoleId &&
    (readString(data, "custom_role_id") === customRoleId ||
      readString(data, "role_definition_id") === customRoleId)) ||
    moduleRecords.find((data) =>
      (readString(data, "role_key") || readString(data, "role_type") ||
        readString(data, "base_role_key")) === role &&
      !readString(data, "custom_role_id") &&
      !readString(data, "role_definition_id"));
  const override = overrideSnapshot.docs.map((doc) => doc.data())
    .filter(active).find((data) => readString(data, "user_id") === uid &&
      readString(data, "module_key") === "atlas");
  const mode = override ? readString(override, "override_mode") || "restrict" : null;
  const selected = override && mode === "replace" ?
    override : base;
  const allowed = selected?.can_view === true &&
    (!override || readString(override, "override_mode") === "replace" ||
      readString(override, "override_mode") === "inherit" ||
      override.can_view === true);
  const baseScope = selected ? readString(selected, "record_scope") : null;
  const ranks: Record<string, number> = {none: 0, own: 1, team: 2, all: 3};
  const overrideScope = override ? readString(override, "record_scope") : null;
  const scope = mode === "restrict" && baseScope && overrideScope ?
    (ranks[baseScope] <= ranks[overrideScope] ? baseScope : overrideScope) :
    baseScope;
  if (!allowed || !scope || scope === "none") {
    throw new HttpsError("permission-denied", "ATLAS access is not permitted.");
  }
  return scope;
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
  if (mode === "disabled") {
    return {success: false, status: "unavailable", operation: request.operation,
      reason: "ai_disabled", requestId: id};
  }

  if (mode === "client_managed") {
    return {success: false, status: "unavailable", operation: request.operation,
      reason: "provider_not_configured", requestId: id};
  }

  if (request.operation === "document_extraction") {
    if (!dependencies.artifacts || !request.context) {
      return {success: false, status: "unavailable", operation: request.operation,
        reason: "provider_not_configured", requestId: id};
    }
    const startedAt = Date.now();
    const output = await dependencies.artifacts.extractDocument(
      actor.uid, request.context
    );
    await writeUsage(dependencies.firestore, id, actor.uid, request.operation, {
      output, provider: "atlas_document", model: "deterministic-v1",
      inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0,
    }, "completed", Date.now() - startedAt, now);
    return {success: true, status: "completed", operation: request.operation,
      output, requestId: id};
  }

  if (!dependencies.provider) {
    return {success: false, status: "unavailable", operation: request.operation,
      reason: "provider_not_configured", requestId: id};
  }

  const startedAt = Date.now();
  let providerRequest = request;
  const crmContext = await loadAuthorizedCrmContext(
    dependencies.firestore, actor, request.context
  );
  if (crmContext.length > 0) {
    providerRequest = {
      ...providerRequest,
      context: {...providerRequest.context, server_crm_context: crmContext},
    };
  }
  if (request.context && dependencies.artifacts &&
      (request.operation === "lead_import" || request.operation === "conversation")) {
    const images = await dependencies.artifacts.authorizeImages(
      actor.uid, request.context
    );
    providerRequest = {
      ...providerRequest,
      context: {
        ...providerRequest.context,
        authorized_image_data_urls: images,
      },
    };
  }

  let providerResult: AtlasProviderResult;
  try {
    providerResult = await dependencies.provider.execute(providerRequest);
  } catch (error) {
    await writeUsage(dependencies.firestore, id, actor.uid, request.operation,
      null, "failed", Date.now() - startedAt, now);
    logger.error("ATLAS provider request failed", {
      requestId: id,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new HttpsError("unavailable", "ATLAS could not complete the request.");
  }

  let output = providerResult.output;
  if (request.operation === "image_generation") {
    if (!dependencies.artifacts) {
      throw new HttpsError("failed-precondition", "Image storage is unavailable.");
    }
    output = await dependencies.artifacts.persistGeneratedImage(
      actor.uid, id, output
    );
  }
  await writeUsage(dependencies.firestore, id, actor.uid, request.operation,
    providerResult, "completed", Date.now() - startedAt, now);

  logger.info("ATLAS AI request completed", {
    requestId: id,
    operation: request.operation,
    mode,
    actorRole: actor.role,
    actorScope: actor.scope,
    inputCharacters: request.input.length,
    contextBytes: request.context ?
      Buffer.byteLength(
        JSON.stringify(request.context),
        "utf8"
      ) :
      0,
  });

  return {
    success: true,
    status: "completed",
    operation: request.operation,
    output,
    requestId: id,
  };
}

async function loadAuthorizedCrmContext(
  firestore: Firestore,
  actor: {uid: string; scope: string; teamId: string | null},
  context?: DataRecord
): Promise<DataRecord[]> {
  const references = Array.isArray(context?.record_refs) ?
    context.record_refs.slice(0, 20) : [];
  const allowedEntities = new Set(["Lead", "Opportunity", "Activity", "Task"]);
  const records: DataRecord[] = [];
  for (const raw of references) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const reference = raw as DataRecord;
    const entity = readString(reference, "entity");
    const id = readString(reference, "id");
    if (!entity || !id || !allowedEntities.has(entity)) {
      throw new HttpsError("invalid-argument", "CRM context reference is invalid.");
    }
    const snapshot = await firestore.collection("entities").doc(entity)
      .collection("records").doc(id).get();
    if (!snapshot.exists) continue;
    const data = snapshot.data() || {};
    const owner = readString(data, "owner_user_id") || readString(data, "ownerId");
    const team = readString(data, "assigned_team_id") || readString(data, "teamId");
    const authorized = actor.scope === "all" ||
      (actor.scope === "team" && (owner === actor.uid ||
        (actor.teamId !== null && team === actor.teamId))) ||
      (actor.scope === "own" && owner === actor.uid);
    if (!authorized) {
      throw new HttpsError("permission-denied", "CRM context is not authorized.");
    }
    records.push({entity, id, ...data});
  }
  return records;
}

async function writeUsage(
  firestore: Firestore, id: string, uid: string, operation: AiOperation,
  result: AtlasProviderResult | null, status: "completed" | "failed",
  latencyMs: number, now: number
): Promise<void> {
  await firestore.collection("atlasAiUsage").doc(id).create({
    user_id: uid, provider: result?.provider || null,
    model: result?.model || null, input_tokens: result?.inputTokens || 0,
    output_tokens: result?.outputTokens || 0,
    estimated_cost_usd: result?.estimatedCostUsd ?? null,
    request_type: operation, created_date: new Date(now).toISOString(),
    correlation_id: id, status, latency_ms: latencyMs,
  });
}
