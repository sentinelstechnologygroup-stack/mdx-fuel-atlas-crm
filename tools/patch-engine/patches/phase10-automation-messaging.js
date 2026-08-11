export default {
  id: 'phase10-automation-messaging',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore', 'functions/src/index.ts',
    'functions/src/notificationDeliveryBridge.ts', 'package.json',
    'tests/notification.delivery.bridge.test.js',
  ],
  files: [
    {
      path: 'functions/src/automation.ts',
      operations: [
        {
          type: 'insertAfter',
          anchor: 'import {onDocumentWritten} from "firebase-functions/v2/firestore";\n',
          content: '\nimport {\n  FirestoreDeliveryRecordRepository,\n} from "./firestoreDeliveryRepository";\nimport {\n  executeRecordedDelivery,\n} from "./messageDeliveryService";\nimport {\n  createMessagingProvidersFromEnvironment,\n  DeliveryRequest,\n  MessagingEnvironment,\n} from "./messagingProviders";\n',
        },
        {
          type: 'replace',
          anchor: 'function actionSummary(\n  rule: AutomationRule,\n): string {\n  return `${rule.action_type}: ${JSON.stringify(\n    rule.action_config,\n  )}`;\n}\n',
          content: 'function actionSummary(\n  rule: AutomationRule,\n): string {\n  if (rule.action_type === "send_email") {\n    return "send_email: server-controlled delivery";\n  }\n\n  return `${rule.action_type}: ${JSON.stringify(\n    rule.action_config,\n  )}`;\n}\n',
        },
        {
          type: 'insertBefore',
          anchor: 'async function executeRule(\n',
          content: 'function validEmail(value: string): boolean {\n  return (\n    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) &&\n    value.length <= 254\n  );\n}\n\n+export function buildAutomationEmailRequest(\n  rule: AutomationRule,\n  entityName: string,\n  recordId: string,\n  eventId: string,\n  data: DocumentData,\n): DeliveryRequest {\n  const recipient = replacePlaceholders(\n    readString(rule.action_config, "email_to") || "",\n    data,\n  ).trim();\n  const subject = replacePlaceholders(\n    readString(rule.action_config, "email_subject") || "",\n    data,\n  ).trim();\n  const message = replacePlaceholders(\n    readString(rule.action_config, "email_body") || "",\n    data,\n  ).trim();\n\n  if (!validEmail(recipient)) {\n    throw new Error(\n      "Automation email recipient is missing or invalid.",\n    );\n  }\n\n  if (!subject) {\n    throw new Error(\n      "Automation email subject is required.",\n    );\n  }\n\n  if (!message) {\n    throw new Error(\n      "Automation email body is required.",\n    );\n  }\n\n  return {\n    idempotencyKey:\n      `automation:${executionId(eventId, rule.id)}:email`,\n    recipient,\n    subject: subject.slice(0, 200),\n    message: message.slice(0, 10000),\n    sourceType: "Automation",\n    sourceId: `${entityName}/${recordId}`,\n  };\n}\n\nasync function sendEmailAndLog(\n  rule: AutomationRule,\n  entityName: string,\n  recordId: string,\n  eventId: string,\n  data: DocumentData,\n): Promise<void> {\n  const request = buildAutomationEmailRequest(\n    rule, entityName, recordId, eventId, data,\n  );\n  const environment: MessagingEnvironment = {\n    RESEND_API_KEY: process.env.RESEND_API_KEY,\n    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,\n    RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,\n  };\n  const provider =\n    createMessagingProvidersFromEnvironment(\n      environment,\n    ).email;\n  const repository =\n    new FirestoreDeliveryRecordRepository(database);\n  const result = await executeRecordedDelivery(\n    provider, request, repository,\n  );\n  const status = result.record.status === "sent" ?\n    "success" :\n    result.record.status;\n  const logReference = entityRecords(\n    database,\n    "AutomationLog",\n  ).doc(executionId(eventId, rule.id));\n  const now = new Date().toISOString();\n\n  await database.runTransaction(\n    async (transaction: Transaction) => {\n      if ((await transaction.get(logReference)).exists) {\n        return;\n      }\n\n      transaction.set(\n        logReference,\n        buildLog(\n          rule, entityName, recordId, eventId,\n          status, result.record.reason, now,\n        ),\n      );\n    },\n  );\n}\n\n',
        },
        {
          type: 'replace',
          anchor: '  if (rule.action_type === "send_email") {\n    await writeFailureLog(\n      rule,\n      entityName,\n      recordId,\n      eventId,\n      "The send_email action is blocked until a " +\n        "Firebase-native email provider is configured.",\n    );\n\n    return;\n  }\n',
          content: '  if (rule.action_type === "send_email") {\n    await sendEmailAndLog(\n      rule,\n      entityName,\n      recordId,\n      eventId,\n      data,\n    );\n\n    return;\n  }\n',
        },
      ],
    },
    {
      path: 'tests/automation.messaging.test.js',
      create: true,
      content: `import {describe, expect, it} from "vitest";
import {buildAutomationEmailRequest} from "../functions/src/automation.ts";

const rule = {
  id: "welcome-email",
  name: "Welcome email",
  trigger_entity: "Lead",
  trigger_event: "create",
  condition_field: null,
  condition_operator: "equals",
  condition_value: null,
  action_type: "send_email",
  action_config: {
    email_to: "{{email}}",
    email_subject: "Welcome, {{full_name}}",
    email_body: "Call us at {{phone_number}}.",
  },
};

describe("Phase 10 automation messaging", () => {
  it("builds a deterministic server-owned request", () => {
    const first = buildAutomationEmailRequest(
      rule, "Lead", "lead-1", "event-1",
      {
        email: "lead@example.test",
        full_name: "Fleet Manager",
        phone_number: "281-555-0101",
      },
    );
    const second = buildAutomationEmailRequest(
      rule, "Lead", "lead-1", "event-1",
      {
        email: "lead@example.test",
        full_name: "Fleet Manager",
        phone_number: "281-555-0101",
      },
    );

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      recipient: "lead@example.test",
      subject: "Welcome, Fleet Manager",
      message: "Call us at 281-555-0101.",
      sourceType: "Automation",
      sourceId: "Lead/lead-1",
    });
    expect(first.idempotencyKey)
      .toMatch(/^automation:[a-f0-9]{64}:email$/);
  });

  it.each([
    [{email_to: "invalid", email_subject: "Subject", email_body: "Body"}, /recipient/],
    [{email_to: "{{email}}", email_subject: "", email_body: "Body"}, /subject/],
    [{email_to: "{{email}}", email_subject: "Subject", email_body: ""}, /body/],
  ])("rejects unsafe or incomplete configuration", (action_config, error) => {
    expect(() => buildAutomationEmailRequest(
      {...rule, action_config},
      "Lead", "lead-2", "event-2",
      {email: "lead@example.test"},
    )).toThrow(error);
  });
});
`,
    },
    {
      path: 'package.json',
      operations: [{
        type: 'insertAfter',
        anchor: '    "test:notification:delivery": "vitest run --no-file-parallelism tests/notification.delivery.bridge.test.js",\n',
        content: '    "test:automation:messaging": "vitest run --no-file-parallelism tests/automation.messaging.test.js",\n',
      }],
    },
  ],
};
