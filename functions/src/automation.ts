import {createHash} from "node:crypto";

import {getApps, initializeApp} from "firebase-admin/app";
import {
  DocumentData,
  Firestore,
  Transaction,
  getFirestore,
} from "firebase-admin/firestore";
import {onDocumentWritten} from "firebase-functions/v2/firestore";

import {
  FirestoreDeliveryRecordRepository,
} from "./firestoreDeliveryRepository";
import {
  executeRecordedDelivery,
} from "./messageDeliveryService";
import {
  createMessagingProvidersFromEnvironment,
  DeliveryRequest,
} from "./messagingProviders";
import {
  EMAIL_MESSAGING_SECRETS,
  emailMessagingEnvironment,
} from "./messagingRuntimeConfig";

/* eslint-disable require-jsdoc */

type AutomationRule = {
  id: string;
  name: string;
  trigger_entity: string;
  trigger_event: string;
  condition_field: string | null;
  condition_operator: string;
  condition_value: unknown;
  action_type: string;
  action_config: Record<string, unknown>;
};

const supportedEntities = new Set([
  "Lead",
  "Opportunity",
]);

const firebaseAdminApp = getApps().length > 0 ?
  getApps()[0] :
  initializeApp();

const database = getFirestore(firebaseAdminApp);

function entityRecords(
  firestore: Firestore,
  entityName: string,
) {
  return firestore
    .collection("entities")
    .doc(entityName)
    .collection("records");
}

function readString(
  data: Record<string, unknown>,
  field: string,
): string | null {
  const value = data[field];

  return typeof value === "string" &&
    value.trim().length > 0 ?
    value.trim() :
    null;
}

function readConfig(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeRule(
  id: string,
  data: DocumentData,
): AutomationRule {
  return {
    id,
    name: readString(data, "name") || id,
    trigger_entity:
      readString(data, "trigger_entity") || "",
    trigger_event:
      readString(data, "trigger_event") || "",
    condition_field:
      readString(data, "condition_field"),
    condition_operator:
      readString(data, "condition_operator") ||
      "equals",
    condition_value: data.condition_value,
    action_type:
      readString(data, "action_type") || "",
    action_config: readConfig(data.action_config),
  };
}

function valuesEqual(
  left: unknown,
  right: unknown,
): boolean {
  return left === right;
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === ""
  );
}

function evaluateCondition(
  rule: AutomationRule,
  newData: DocumentData,
  previousData: DocumentData | null,
  eventType: string,
): boolean {
  if (!rule.condition_field) {
    return true;
  }

  const field = rule.condition_field;
  const fieldValue = newData[field];
  const conditionValue = rule.condition_value;

  switch (rule.condition_operator) {
  case "equals": {
    if (eventType === "update" && previousData) {
      return (
        !valuesEqual(
          previousData[field],
          conditionValue,
        ) &&
          valuesEqual(fieldValue, conditionValue)
      );
    }

    return valuesEqual(fieldValue, conditionValue);
  }

  case "not_equals":
    return !valuesEqual(fieldValue, conditionValue);

  case "contains":
    return String(fieldValue ?? "")
      .includes(String(conditionValue ?? ""));

  case "greater_than":
    return Number(fieldValue) > Number(conditionValue);

  case "less_than":
    return Number(fieldValue) < Number(conditionValue);

  case "is_empty":
    return isEmpty(fieldValue);

  case "is_not_empty":
    return !isEmpty(fieldValue);

  default:
    return false;
  }
}

function replacePlaceholders(
  text: string,
  data: DocumentData,
): string {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => {
      const value = data[key];

      return value === null || value === undefined ?
        "" :
        String(value);
    },
  );
}

function executionId(
  eventId: string,
  ruleId: string,
): string {
  return createHash("sha256")
    .update(`${eventId}:${ruleId}`)
    .digest("hex");
}

function taskId(
  eventId: string,
  ruleId: string,
): string {
  const digest = createHash("sha256")
    .update(`task:${eventId}:${ruleId}`)
    .digest("hex");

  return `automation-${digest}`;
}

function normalizeDueDays(value: unknown): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 1;
  }

  return Math.min(
    3650,
    Math.max(0, Math.trunc(numericValue)),
  );
}

function calculateDueDate(
  dueDays: number,
): string {
  const dueDate = new Date();

  dueDate.setUTCDate(
    dueDate.getUTCDate() + dueDays,
  );

  return dueDate.toISOString().slice(0, 10);
}

function actionSummary(
  rule: AutomationRule,
): string {
  if (rule.action_type === "send_email") {
    return "send_email: server-controlled delivery";
  }

  return `${rule.action_type}: ${JSON.stringify(
    rule.action_config,
  )}`;
}

function buildLog(
  rule: AutomationRule,
  entityName: string,
  recordId: string,
  eventId: string,
  status: string,
  errorMessage: string | null,
  now: string,
) {
  return {
    rule_id: rule.id,
    rule_name: rule.name,
    entity_type: entityName,
    entity_id: recordId,
    trigger_event: rule.trigger_event,
    event_id: eventId,
    status,
    error_message: errorMessage,
    action_taken: actionSummary(rule),
    execution_time: now,
    created_date: now,
    updated_date: now,
  };
}

async function createTaskAndLog(
  rule: AutomationRule,
  entityName: string,
  recordId: string,
  eventId: string,
  data: DocumentData,
): Promise<boolean> {
  const config = rule.action_config;
  const logReference = entityRecords(
    database,
    "AutomationLog",
  ).doc(executionId(eventId, rule.id));

  const taskReference = entityRecords(
    database,
    "Task",
  ).doc(taskId(eventId, rule.id));

  return database.runTransaction(
    async (transaction: Transaction) => {
      const existingLog =
        await transaction.get(logReference);

      if (existingLog.exists) {
        return false;
      }

      const rawTitle =
        readString(config, "task_title") ||
        `Automation task: ${rule.name}`;

      const rawDescription =
        readString(config, "task_description") || "";

      const title = replacePlaceholders(
        rawTitle,
        data,
      ).slice(0, 240);

      const description = replacePlaceholders(
        rawDescription,
        data,
      ).slice(0, 10000);

      const dueDays = normalizeDueDays(
        config.task_due_days,
      );

      const now = new Date().toISOString();

      transaction.set(taskReference, {
        title,
        description,
        status: "todo",
        due_date: calculateDueDate(dueDays),
        related_lead_id:
          entityName === "Lead" ?
            recordId :
            data.lead_id ?? null,
        related_opportunity_id:
          entityName === "Opportunity" ?
            recordId :
            null,
        owner_user_id:
          data.owner_user_id ?? null,
        assigned_team_id:
          data.assigned_team_id ?? null,
        automation_rule_id: rule.id,
        automation_event_id: eventId,
        created_by_user_id:
          data.last_modified_by_user_id ??
          data.created_by_user_id ??
          data.owner_user_id ??
          null,
        created_date: now,
        updated_date: now,
      });

      transaction.set(
        logReference,
        buildLog(
          rule,
          entityName,
          recordId,
          eventId,
          "success",
          null,
          now,
        ),
      );

      return true;
    },
  );
}

async function writeFailureLog(
  rule: AutomationRule,
  entityName: string,
  recordId: string,
  eventId: string,
  errorMessage: string,
): Promise<void> {
  const logReference = entityRecords(
    database,
    "AutomationLog",
  ).doc(executionId(eventId, rule.id));

  await database.runTransaction(
    async (transaction: Transaction) => {
      const existingLog =
        await transaction.get(logReference);

      if (existingLog.exists) {
        return;
      }

      const now = new Date().toISOString();

      transaction.set(
        logReference,
        buildLog(
          rule,
          entityName,
          recordId,
          eventId,
          "failed",
          errorMessage,
          now,
        ),
      );
    },
  );
}

function validEmail(value: string): boolean {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    value.length <= 254
  );
}

export function buildAutomationEmailRequest(
  rule: AutomationRule,
  entityName: string,
  recordId: string,
  eventId: string,
  data: DocumentData,
): DeliveryRequest {
  const recipient = replacePlaceholders(
    readString(rule.action_config, "email_to") || "",
    data,
  ).trim();
  const subject = replacePlaceholders(
    readString(rule.action_config, "email_subject") || "",
    data,
  ).trim();
  const message = replacePlaceholders(
    readString(rule.action_config, "email_body") || "",
    data,
  ).trim();

  if (!validEmail(recipient)) {
    throw new Error(
      "Automation email recipient is missing or invalid.",
    );
  }

  if (!subject) {
    throw new Error(
      "Automation email subject is required.",
    );
  }

  if (!message) {
    throw new Error(
      "Automation email body is required.",
    );
  }

  return {
    idempotencyKey:
      `automation:${executionId(eventId, rule.id)}:email`,
    recipient,
    subject: subject.slice(0, 200),
    message: message.slice(0, 10000),
    sourceType: "Automation",
    sourceId: `${entityName}/${recordId}`,
  };
}

async function sendEmailAndLog(
  rule: AutomationRule,
  entityName: string,
  recordId: string,
  eventId: string,
  data: DocumentData,
): Promise<void> {
  const request = buildAutomationEmailRequest(
    rule, entityName, recordId, eventId, data,
  );
  const environment = emailMessagingEnvironment();
  const provider =
    createMessagingProvidersFromEnvironment(
      environment,
    ).email;
  const repository =
    new FirestoreDeliveryRecordRepository(database);
  const result = await executeRecordedDelivery(
    provider, request, repository,
  );
  const status = result.record.status === "sent" ?
    "success" :
    result.record.status;
  const logReference = entityRecords(
    database,
    "AutomationLog",
  ).doc(executionId(eventId, rule.id));
  const now = new Date().toISOString();

  await database.runTransaction(
    async (transaction: Transaction) => {
      if ((await transaction.get(logReference)).exists) {
        return;
      }

      transaction.set(
        logReference,
        buildLog(
          rule, entityName, recordId, eventId,
          status, result.record.reason, now,
        ),
      );
    },
  );
}

async function executeRule(
  rule: AutomationRule,
  entityName: string,
  recordId: string,
  eventId: string,
  data: DocumentData,
): Promise<void> {
  if (rule.action_type === "create_task") {
    await createTaskAndLog(
      rule,
      entityName,
      recordId,
      eventId,
      data,
    );

    return;
  }

  if (rule.action_type === "update_entity") {
    await writeFailureLog(
      rule,
      entityName,
      recordId,
      eventId,
      "The update_entity action is blocked until " +
        "its server-side field allowlist is configured.",
    );

    return;
  }

  if (rule.action_type === "send_email") {
    await sendEmailAndLog(
      rule,
      entityName,
      recordId,
      eventId,
      data,
    );

    return;
  }

  await writeFailureLog(
    rule,
    entityName,
    recordId,
    eventId,
    "Unsupported automation action type.",
  );
}

export const processAutomationWrite =
  onDocumentWritten(
    {
      document: "entities/{entityName}/records/{recordId}",
      region: "us-central1",
      secrets: EMAIL_MESSAGING_SECRETS,
    },
    async (event) => {
      const entityName = event.params.entityName;
      const recordId = event.params.recordId;

      if (!supportedEntities.has(entityName)) {
        return;
      }

      const change = event.data;

      if (!change || !change.after.exists) {
        return;
      }

      const eventType =
        change.before.exists ? "update" : "create";

      const newData = change.after.data();

      if (!newData) {
        return;
      }

      const previousData =
        change.before.exists ?
          (change.before.data() ?? null) :
          null;

      const rulesSnapshot = await entityRecords(
        database,
        "AutomationRule",
      )
        .where("trigger_entity", "==", entityName)
        .where("trigger_event", "==", eventType)
        .where("is_active", "==", true)
        .get();

      for (const document of rulesSnapshot.docs) {
        const rule = normalizeRule(
          document.id,
          document.data(),
        );

        if (
          !evaluateCondition(
            rule,
            newData,
            previousData,
            eventType,
          )
        ) {
          continue;
        }

        try {
          await executeRule(
            rule,
            entityName,
            recordId,
            event.id,
            newData,
          );
        } catch (error) {
          const message =
            error instanceof Error ?
              error.message :
              "Unknown automation execution error.";

          await writeFailureLog(
            rule,
            entityName,
            recordId,
            event.id,
            message,
          );
        }
      }
    },
  );

/* eslint-enable require-jsdoc */
