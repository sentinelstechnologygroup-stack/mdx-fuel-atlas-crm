/* eslint-disable require-jsdoc */
import {createHash} from "node:crypto";

import {getFirestore} from "firebase-admin/firestore";
import {onDocumentCreated} from "firebase-functions/v2/firestore";

import type {
  AtlasAiProvider,
  AtlasProviderResult,
} from "./atlasAiProvider.js";
import {OpenAiAtlasProvider} from "./atlasAiProvider.js";
import {
  atlasAiEnvironment,
  atlasOpenAiApiKey,
} from "./atlasAiRuntimeConfig.js";

type EntityData = Record<string, unknown>;

export type LeadQualificationResult = {
  leadId: string;
  score: number;
  classification: "Hot" | "Warm" | "Cold";
  reasoning: string;
  qualified: boolean;
  duplicate: boolean;
  status: "completed" | "unavailable" | "failed";
};

const LEAD_PATH = "entities/Lead/records";
const DISCOVERY_PATH = "entities/DiscoveryData/records";
const TASK_PATH = "entities/Task/records";
const NOTIFICATION_PATH = "entities/Notification/records";
const AUDIT_PATH = "entities/AuditLog/records";
const USAGE_PATH = "atlasAiUsage";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    score: {type: "integer", minimum: 0, maximum: 100},
    classification: {type: "string", enum: ["Hot", "Warm", "Cold"]},
    reasoning: {type: "string"},
  },
  required: ["score", "classification", "reasoning"],
  additionalProperties: false,
};

function readString(data: EntityData, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function deterministicId(prefix: string, leadId: string): string {
  return `${prefix}-${createHash("sha256")
    .update(`${prefix}:${leadId}`).digest("hex").slice(0, 40)}`;
}

function normalizeScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function normalizeClassification(
  value: unknown,
  score: number
): "Hot" | "Warm" | "Cold" {
  if (value === "Hot" || value === "Warm" || value === "Cold") return value;
  if (score >= 70) return "Hot";
  if (score >= 40) return "Warm";
  return "Cold";
}

function normalizeProviderOutput(result: AtlasProviderResult): {
  score: number;
  classification: "Hot" | "Warm" | "Cold";
  reasoning: string;
} {
  const output = result.output && typeof result.output === "object" &&
    !Array.isArray(result.output) ? result.output as EntityData : {};
  const score = normalizeScore(output.score);
  return {
    score,
    classification: normalizeClassification(output.classification, score),
    reasoning: readString(output, "reasoning")?.slice(0, 1000) ?? "",
  };
}

function promptForLead(
  lead: EntityData,
  discovery: EntityData | null
): string {
  return [
    "Score this new fuel-sales lead from 0 to 100 using only supplied data.",
    `Lead: ${readString(
      lead, "full_name", "company_name", "name"
    ) ?? "Unknown"}`,
    `City: ${readString(lead, "city") ?? "n/a"}`,
    `Source: ${readString(lead, "lead_source", "source_year") ?? "n/a"}`,
    `Requirements: ${readString(discovery ?? {}, "requirements") ?? "n/a"}`,
    `Budget: ${String(discovery?.budget ?? "n/a")}`,
    `Timeline: ${readString(discovery ?? {}, "timeline") ?? "n/a"}`,
    `Notes: ${readString(discovery ?? {}, "notes") ?? "n/a"}`,
    "Classify the result as Hot, Warm, or Cold and provide one short reason.",
  ].join("\n");
}

async function writeUsage(
  leadId: string,
  result: AtlasProviderResult | null,
  status: "completed" | "unavailable" | "failed",
  startedAt: number,
  now: string
): Promise<void> {
  const reference = getFirestore().collection(USAGE_PATH)
    .doc(deterministicId("lead-qualification", leadId));
  if ((await reference.get()).exists) return;
  await reference.create({
    user_id: "system",
    provider: result?.provider ?? null,
    model: result?.model ?? null,
    input_tokens: result?.inputTokens ?? 0,
    output_tokens: result?.outputTokens ?? 0,
    estimated_cost_usd: result?.estimatedCostUsd ?? null,
    request_type: "lead_qualification",
    created_date: now,
    correlation_id: reference.id,
    status,
    latency_ms: Math.max(0, Date.now() - startedAt),
    lead_id: leadId,
  });
}

export async function processLeadQualification(
  leadId: string,
  provider?: AtlasAiProvider,
  requestedNow?: string
): Promise<LeadQualificationResult> {
  const firestore = getFirestore();
  const leadReference = firestore.collection(LEAD_PATH).doc(leadId);
  const auditReference = firestore.collection(AUDIT_PATH)
    .doc(deterministicId("lead-qualified", leadId));
  const [leadSnapshot, auditSnapshot] = await Promise.all([
    leadReference.get(), auditReference.get(),
  ]);
  if (!leadSnapshot.exists) throw new Error("Lead not found.");
  const lead = leadSnapshot.data() as EntityData;
  if (auditSnapshot.exists) {
    return {
      leadId,
      score: normalizeScore(lead.ai_quality_score),
      classification: normalizeClassification(
        lead.ai_classification, normalizeScore(lead.ai_quality_score)
      ),
      reasoning: readString(lead, "ai_analysis") ?? "",
      qualified: true,
      duplicate: true,
      status: "completed",
    };
  }

  const now = requestedNow ?? new Date().toISOString();
  const startedAt = Date.now();
  const discoverySnapshot = await firestore.collection(DISCOVERY_PATH)
    .where("lead_id", "==", leadId).limit(1).get();
  const discovery = discoverySnapshot.empty ? null :
    discoverySnapshot.docs[0].data() as EntityData;
  let providerResult: AtlasProviderResult | null = null;
  let status: "completed" | "unavailable" | "failed" = "unavailable";
  let score = 0;
  let classification: "Hot" | "Warm" | "Cold" = "Cold";
  let reasoning = "";

  if (provider) {
    try {
      providerResult = await provider.execute({
        operation: "lead_analysis",
        input: promptForLead(lead, discovery),
        context: {response_json_schema: RESPONSE_SCHEMA},
      });
      ({score, classification, reasoning} =
        normalizeProviderOutput(providerResult));
      status = "completed";
    } catch {
      status = "failed";
    }
  }

  await writeUsage(leadId, providerResult, status, startedAt, now);
  const qualified = status === "completed" && score >= 70;
  if (status !== "completed") {
    return {
      leadId,
      score,
      classification,
      reasoning,
      qualified: false,
      duplicate: false,
      status,
    };
  }
  const ownerId = readString(
    lead, "owner_user_id", "ownerId", "created_by_user_id"
  );
  const ownerEmail = readString(lead, "assigned_to", "email");
  const leadName = readString(
    lead, "full_name", "company_name", "name"
  ) ?? leadId;

  await firestore.runTransaction(async (transaction) => {
    if ((await transaction.get(auditReference)).exists) return;
    transaction.update(leadReference, {
      ai_quality_score: score,
      ai_classification: classification,
      ai_analysis: reasoning,
      ai_last_analysis_date: now,
      updated_date: now,
      last_modified_by_user_id: "system",
      ...(qualified ? {lead_status: "Qualified"} : {}),
    });
    if (!qualified) return;

    const taskReference = firestore.collection(TASK_PATH)
      .doc(deterministicId("qualified-lead-task", leadId));
    const dueDate = new Date(now);
    dueDate.setUTCDate(dueDate.getUTCDate() + 2);
    transaction.set(taskReference, {
      title: `Follow up with qualified lead: ${leadName}`,
      description: [
        `This lead scored ${score}/100 (${classification}).`,
        reasoning,
      ].join(" ").trim(),
      status: "todo",
      priority: "high",
      due_date: dueDate.toISOString().slice(0, 10),
      assigned_to: ownerEmail,
      owner_user_id: ownerId,
      related_lead_id: leadId,
      workflow_key: `lead-qualification:${leadId}`,
      created_by_user_id: "system",
      created_date: now,
      updated_date: now,
    }, {merge: false});

    if (ownerId || ownerEmail) {
      const notificationReference = firestore.collection(NOTIFICATION_PATH)
        .doc(deterministicId("qualified-lead-notification", leadId));
      transaction.set(notificationReference, {
        title: "Lead automatically qualified",
        message: `${leadName} scored ${score}/100 (${classification}).`,
        type: "lead",
        related_entity_type: "Lead",
        related_entity_id: leadId,
        user_id: ownerId,
        user_email: ownerEmail,
        is_read: false,
        server_controlled: true,
        notification_source: "lead_qualification_workflow",
        deterministic_key: notificationReference.id,
        created_by_user_id: "system",
        created_date: now,
        updated_date: now,
      }, {merge: false});
    }

    transaction.create(auditReference, {
      action: "lead_automatically_qualified",
      lead_id: leadId,
      score,
      classification,
      task_id: taskReference.id,
      actor_user_id: "system",
      created_date: now,
      updated_date: now,
    });
  });

  return {
    leadId, score, classification, reasoning, qualified,
    duplicate: false, status,
  };
}

export const qualifyNewLead = onDocumentCreated(
  {
    document: `${LEAD_PATH}/{leadId}`,
    region: "us-central1",
    retry: true,
    secrets: [atlasOpenAiApiKey],
  },
  async (event) => {
    const environment = atlasAiEnvironment();
    const provider = environment.apiKey ? new OpenAiAtlasProvider({
      ...environment,
      timeoutMs: 30000,
    }) : undefined;
    try {
      await processLeadQualification(
        event.params.leadId,
        provider,
        event.time
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Lead not found."
      ) {
        return;
      }
      throw error;
    }
  }
);
