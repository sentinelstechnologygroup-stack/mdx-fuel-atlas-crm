/* eslint-disable require-jsdoc */
import {createHash} from "node:crypto";

import {getFunctions} from "firebase-admin/functions";
import {getFirestore} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onTaskDispatched} from "firebase-functions/v2/tasks";

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
type EnqueueRecheck = (
  pendingId: string,
  taskId: string
) => Promise<void>;

const OPPORTUNITY_PATH = "entities/Opportunity/records";
const ACTIVITY_PATH = "entities/Activity/records";
const TASK_PATH = "entities/Task/records";
const NOTIFICATION_PATH = "entities/Notification/records";
const AUDIT_PATH = "entities/AuditLog/records";
const PENDING_PATH = "system/staleOpportunityRechecks/records";
const USAGE_PATH = "atlasAiUsage";
const CENTRAL_TIME_ZONE = "America/Chicago";
const THREE_DAYS_SECONDS = 3 * 24 * 60 * 60;

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: {type: "string"},
    task_title: {type: "string"},
    task_description: {type: "string"},
  },
  required: ["summary", "task_title", "task_description"],
  additionalProperties: false,
};

function readString(data: EntityData, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isoDate(value: unknown): string | null {
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (
    value && typeof value === "object" && "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }
  return null;
}

function activityDate(activity: EntityData): string | null {
  return isoDate(
    activity.date ?? activity.activity_date ??
    activity.created_date ?? activity.updated_date
  );
}

function isClosed(opportunity: EntityData): boolean {
  const stage = (readString(
    opportunity, "deal_stage", "status"
  ) ?? "").toLowerCase();
  return stage.includes("closed won") ||
    stage.includes("closed lost") ||
    stage === "won" || stage === "lost" ||
    stage === "cancelled" || stage === "canceled";
}

function relatesToOpportunity(
  activity: EntityData,
  opportunityId: string,
  leadId: string | null
): boolean {
  return readString(
    activity, "opportunity_id", "related_opportunity_id"
  ) === opportunityId || Boolean(
    leadId && readString(
      activity, "lead_id", "related_lead_id"
    ) === leadId
  );
}

function latestActivity(
  activities: EntityData[],
  opportunityId: string,
  leadId: string | null
): string | null {
  const dates = activities
    .filter((activity) => relatesToOpportunity(
      activity, opportunityId, leadId
    ))
    .map(activityDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

function identifier(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha256")
    .update(`${prefix}:${value}`).digest("hex").slice(0, 40)}`;
}

function staleCycleKey(
  opportunityId: string,
  opportunity: EntityData,
  lastActivity: string | null
): string {
  const anchor = lastActivity ?? isoDate(
    opportunity.created_date ?? opportunity.createdAt
  ) ?? "no-activity-date";
  return identifier("stale-cycle", `${opportunityId}:${anchor}`);
}

function owner(opportunity: EntityData): {
  id: string | null;
  email: string | null;
} {
  return {
    id: readString(
      opportunity,
      "owner_user_id",
      "ownerId",
      "created_by_user_id"
    ),
    email: readString(
      opportunity,
      "assigned_to",
      "owner_email",
      "email"
    ),
  };
}

function displayName(opportunity: EntityData, id: string): string {
  return readString(
    opportunity, "lead_name", "company_name", "name", "product_type"
  ) ?? id;
}

async function createPendingRecheck(
  opportunityId: string,
  opportunity: EntityData,
  lastActivity: string | null,
  now: string
): Promise<{pendingId: string; taskId: string; shouldEnqueue: boolean}> {
  const firestore = getFirestore();
  const cycleKey = staleCycleKey(
    opportunityId, opportunity, lastActivity
  );
  const pendingId = identifier("stale-recheck", cycleKey);
  const taskId = identifier("stale-task-queue", cycleKey);
  const pendingReference = firestore.collection(PENDING_PATH).doc(pendingId);
  const notificationReference = firestore.collection(NOTIFICATION_PATH)
    .doc(identifier("stale-opportunity-notice", cycleKey));
  const recipient = owner(opportunity);
  let shouldEnqueue = false;

  await firestore.runTransaction(async (transaction) => {
    const pending = await transaction.get(pendingReference);
    if (pending.exists) {
      shouldEnqueue = pending.data()?.queued !== true &&
        pending.data()?.status === "pending";
      return;
    }
    shouldEnqueue = true;
    transaction.create(pendingReference, {
      opportunity_id: opportunityId,
      lead_id: readString(opportunity, "lead_id"),
      owner_user_id: recipient.id,
      owner_email: recipient.email,
      opportunity_name: displayName(opportunity, opportunityId),
      deal_stage: readString(opportunity, "deal_stage"),
      amount: opportunity.amount ?? null,
      last_activity_at: lastActivity,
      detected_at: now,
      status: "pending",
      queued: false,
      task_id: taskId,
      cycle_key: cycleKey,
      created_date: now,
      updated_date: now,
    });
    if (recipient.id || recipient.email) {
      transaction.set(notificationReference, {
        title: "Opportunity needs attention",
        message: `${displayName(
          opportunity, opportunityId
        )} has had no activity for at least 14 days.`,
        type: "opportunity",
        related_entity_type: "Opportunity",
        related_entity_id: opportunityId,
        user_id: recipient.id,
        user_email: recipient.email,
        is_read: false,
        server_controlled: true,
        notification_source: "stale_opportunity_workflow",
        deterministic_key: notificationReference.id,
        created_by_user_id: "system",
        created_date: now,
        updated_date: now,
      }, {merge: false});
    }
  });
  return {pendingId, taskId, shouldEnqueue};
}

export async function processStaleOpportunityScan(
  requestedNow: string,
  enqueue: EnqueueRecheck
): Promise<{checked: number; stale: number; enqueued: number}> {
  const nowDate = new Date(requestedNow);
  if (Number.isNaN(nowDate.getTime())) throw new Error("Invalid scan date.");
  const cutoff = new Date(nowDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - 14);
  const firestore = getFirestore();
  const [opportunities, activities] = await Promise.all([
    firestore.collection(OPPORTUNITY_PATH).get(),
    firestore.collection(ACTIVITY_PATH).get(),
  ]);
  const activityData = activities.docs.map((document) => document.data());
  let stale = 0;
  let enqueued = 0;

  for (const document of opportunities.docs) {
    const opportunity = document.data();
    if (isClosed(opportunity)) continue;
    const leadId = readString(opportunity, "lead_id");
    const recent = latestActivity(activityData, document.id, leadId);
    if (recent && new Date(recent) >= cutoff) continue;
    stale++;
    const pending = await createPendingRecheck(
      document.id, opportunity, recent, nowDate.toISOString()
    );
    if (!pending.shouldEnqueue) continue;
    try {
      await enqueue(pending.pendingId, pending.taskId);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ?
        String(error.code) : "";
      if (!code.includes("task-already-exists")) throw error;
    }
    await firestore.collection(PENDING_PATH).doc(pending.pendingId).update({
      queued: true,
      queued_date: nowDate.toISOString(),
      updated_date: nowDate.toISOString(),
    });
    enqueued++;
  }
  return {checked: opportunities.size, stale, enqueued};
}

function summaryOutput(
  providerResult: AtlasProviderResult | null,
  name: string
): {title: string; description: string} {
  const output = providerResult?.output &&
    typeof providerResult.output === "object" &&
    !Array.isArray(providerResult.output) ?
    providerResult.output as EntityData : {};
  const summary = readString(output, "summary");
  return {
    title: (readString(output, "task_title") ??
      `Follow up: ${name}`).slice(0, 240),
    description: [
      summary ? `Summary: ${summary}` : null,
      readString(output, "task_description") ??
        "No activity for 17+ days. Review and re-engage the account.",
    ].filter(Boolean).join("\n\n").slice(0, 10000),
  };
}

async function writeUsage(
  pendingId: string,
  opportunityId: string,
  result: AtlasProviderResult | null,
  status: "completed" | "unavailable" | "failed",
  now: string
): Promise<void> {
  const reference = getFirestore().collection(USAGE_PATH)
    .doc(identifier("stale-opportunity-summary", pendingId));
  if ((await reference.get()).exists) return;
  await reference.create({
    user_id: "system",
    provider: result?.provider ?? null,
    model: result?.model ?? null,
    input_tokens: result?.inputTokens ?? 0,
    output_tokens: result?.outputTokens ?? 0,
    estimated_cost_usd: result?.estimatedCostUsd ?? null,
    request_type: "stale_opportunity_summary",
    correlation_id: reference.id,
    opportunity_id: opportunityId,
    status,
    latency_ms: 0,
    created_date: now,
  });
}

export async function processStaleOpportunityRecheck(
  pendingId: string,
  provider?: AtlasAiProvider,
  requestedNow?: string
): Promise<{status: "completed" | "cancelled" | "duplicate"}> {
  const firestore = getFirestore();
  const pendingReference = firestore.collection(PENDING_PATH).doc(pendingId);
  const pendingSnapshot = await pendingReference.get();
  if (!pendingSnapshot.exists) return {status: "cancelled"};
  const pending = pendingSnapshot.data() as EntityData;
  if (pending.status === "completed") return {status: "duplicate"};
  if (pending.status === "cancelled") return {status: "duplicate"};
  const opportunityId = readString(pending, "opportunity_id");
  if (!opportunityId) throw new Error("Pending recheck is invalid.");
  const opportunityReference = firestore.collection(OPPORTUNITY_PATH)
    .doc(opportunityId);
  const [opportunitySnapshot, activitySnapshot] = await Promise.all([
    opportunityReference.get(), firestore.collection(ACTIVITY_PATH).get(),
  ]);
  const now = requestedNow ?? new Date().toISOString();
  if (!opportunitySnapshot.exists || isClosed(
    opportunitySnapshot.data() as EntityData
  )) {
    await pendingReference.update({
      status: "cancelled", cancellation_reason: "opportunity_closed_or_missing",
      completed_date: now, updated_date: now,
    });
    return {status: "cancelled"};
  }
  const opportunity = opportunitySnapshot.data() as EntityData;
  const detectedAt = isoDate(pending.detected_at) ?? now;
  const leadId = readString(opportunity, "lead_id");
  const activitySinceDetection = activitySnapshot.docs.some((document) => {
    const data = document.data();
    const date = activityDate(data);
    return relatesToOpportunity(data, opportunityId, leadId) &&
      Boolean(date && date > detectedAt);
  });
  if (activitySinceDetection) {
    await pendingReference.update({
      status: "cancelled", cancellation_reason: "activity_recorded",
      completed_date: now, updated_date: now,
    });
    return {status: "cancelled"};
  }

  let providerResult: AtlasProviderResult | null = null;
  let usageStatus: "completed" | "unavailable" | "failed" = "unavailable";
  const name = displayName(opportunity, opportunityId);
  if (provider) {
    try {
      providerResult = await provider.execute({
        operation: "activity_summary",
        input: [
          `Opportunity ${name} remains stale after a three-day recheck.`,
          `Stage: ${readString(opportunity, "deal_stage") ?? "n/a"}.`,
          "Provide a concise summary and one concrete follow-up task.",
        ].join("\n"),
        context: {response_json_schema: SUMMARY_SCHEMA},
      });
      usageStatus = "completed";
    } catch {
      usageStatus = "failed";
    }
  }
  await writeUsage(
    pendingId, opportunityId, providerResult, usageStatus, now
  );
  const content = summaryOutput(providerResult, name);
  const taskReference = firestore.collection(TASK_PATH)
    .doc(identifier("stale-opportunity-followup", pendingId));
  const auditReference = firestore.collection(AUDIT_PATH)
    .doc(identifier("stale-opportunity-audit", pendingId));
  const dueDate = new Date(now);
  dueDate.setUTCDate(dueDate.getUTCDate() + 3);
  await firestore.runTransaction(async (transaction) => {
    const freshPending = await transaction.get(pendingReference);
    if (!freshPending.exists || freshPending.data()?.status !== "pending") {
      return;
    }
    transaction.set(taskReference, {
      title: content.title,
      description: content.description,
      status: "todo",
      priority: "high",
      due_date: dueDate.toISOString().slice(0, 10),
      assigned_to: readString(pending, "owner_email"),
      owner_user_id: readString(pending, "owner_user_id"),
      related_opportunity_id: opportunityId,
      related_lead_id: leadId,
      workflow_key: `stale-opportunity:${pendingId}`,
      created_by_user_id: "system",
      created_date: now,
      updated_date: now,
    }, {merge: false});
    transaction.create(auditReference, {
      action: "stale_opportunity_followup_created",
      opportunity_id: opportunityId,
      pending_recheck_id: pendingId,
      task_id: taskReference.id,
      actor_user_id: "system",
      created_date: now,
      updated_date: now,
    });
    transaction.update(pendingReference, {
      status: "completed",
      task_id: taskReference.id,
      completed_date: now,
      updated_date: now,
    });
  });
  return {status: "completed"};
}

export const scanStaleOpportunities = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: CENTRAL_TIME_ZONE,
    region: "us-central1",
    retryCount: 3,
  },
  async (event) => {
    await processStaleOpportunityScan(
      event.scheduleTime,
      async (pendingId, taskId) => {
        await getFunctions().taskQueue(
          "locations/us-central1/functions/recheckStaleOpportunity"
        ).enqueue(
          {pendingId},
          {scheduleDelaySeconds: THREE_DAYS_SECONDS, id: taskId}
        );
      }
    );
  }
);

export const recheckStaleOpportunity = onTaskDispatched(
  {
    region: "us-central1",
    retryConfig: {maxAttempts: 5, minBackoffSeconds: 60},
    rateLimits: {maxConcurrentDispatches: 10},
    secrets: [atlasOpenAiApiKey],
  },
  async (request) => {
    const pendingId = request.data?.pendingId;
    if (typeof pendingId !== "string" || !pendingId.trim()) {
      throw new Error("A pending recheck ID is required.");
    }
    const environment = atlasAiEnvironment();
    const provider = environment.apiKey ? new OpenAiAtlasProvider({
      ...environment,
      timeoutMs: 30000,
    }) : undefined;
    await processStaleOpportunityRecheck(pendingId, provider);
  }
);
