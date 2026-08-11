export default {
  id: 'phase10-notification-bridge',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  files: [
    {
      path: 'functions/src/notificationDeliveryBridge.ts',
      create: true,
      content: `import {getFirestore} from "firebase-admin/firestore";
import {onDocumentCreated} from "firebase-functions/v2/firestore";

import {FirestoreDeliveryRecordRepository} from "./firestoreDeliveryRepository";
import {executeRecordedDelivery, DeliveryExecutionResult, DeliveryRecordRepository} from "./messageDeliveryService";
import {createMessagingProvidersFromEnvironment, DeliveryRequest, MessageProvider, MessagingEnvironment} from "./messagingProviders";

type NotificationData = Record<string, unknown>;

const SUPPORTED_SOURCES = new Set([
  "lead_on_create",
  "daily_reminder_processor",
]);

function readString(data: NotificationData, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isEmail(value: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) && value.length <= 254;
}

export function buildNotificationEmailRequest(
  notificationId: string,
  notification: NotificationData
): DeliveryRequest | null {
  if (notification.server_controlled !== true) return null;
  const source = readString(notification, "notification_source");
  if (!source || !SUPPORTED_SOURCES.has(source)) return null;
  const recipient = readString(notification, "user_email");
  const title = readString(notification, "title");
  const message = readString(notification, "message");
  if (!recipient || !isEmail(recipient) || !title || !message) return null;

  return {
    idempotencyKey: \`notification:\${notificationId}:email\`,
    recipient,
    subject: title.slice(0, 200),
    message: message.slice(0, 10000),
    sourceType: "Notification",
    sourceId: notificationId,
  };
}

export async function processNotificationDelivery(
  notificationId: string,
  notification: NotificationData,
  provider: MessageProvider,
  repository: DeliveryRecordRepository
): Promise<DeliveryExecutionResult | null> {
  const request = buildNotificationEmailRequest(notificationId, notification);
  if (!request) return null;
  return executeRecordedDelivery(provider, request, repository);
}

export const deliverNotificationEmail = onDocumentCreated(
  {
    document: "entities/Notification/records/{notificationId}",
    region: "us-central1",
    retry: true,
  },
  async (event) => {
    if (!event.data) return;
    const firestore = getFirestore();
    const environment: MessagingEnvironment = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
      RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,
    };
    const provider = createMessagingProvidersFromEnvironment(environment).email;
    const repository = new FirestoreDeliveryRecordRepository(firestore);
    const result = await processNotificationDelivery(
      event.params.notificationId,
      event.data.data() as NotificationData,
      provider,
      repository
    );
    if (result?.record.status === "failed" && result.record.attemptCount < 3) {
      throw new Error("Notification email delivery will be retried.");
    }
  }
);
`,
    },
    {
      path: 'tests/notification.delivery.bridge.test.js',
      create: true,
      content: `import {describe, expect, it} from "vitest";
import {buildNotificationEmailRequest, processNotificationDelivery} from "../functions/src/notificationDeliveryBridge.ts";
import {MockMessageProvider} from "../functions/src/messagingProviders.ts";

class MemoryRepository {
  records = new Map();
  async get(key) { return this.records.get(key) ?? null; }
  async create(record) {
    if (this.records.has(record.idempotencyKey)) return false;
    this.records.set(record.idempotencyKey, record);
    return true;
  }
  async update(key, changes) {
    this.records.set(key, {...this.records.get(key), ...changes});
  }
}

const notification = {
  server_controlled: true,
  notification_source: "lead_on_create",
  user_email: "recipient@example.test",
  title: "New lead received",
  message: "North Houston Fleet - 281-555-0101",
};

describe("Phase 10 notification delivery bridge", () => {
  it("builds a deterministic server-owned email request", () => {
    expect(buildNotificationEmailRequest("notification-1", notification)).toEqual({
      idempotencyKey: "notification:notification-1:email",
      recipient: "recipient@example.test",
      subject: "New lead received",
      message: "North Houston Fleet - 281-555-0101",
      sourceType: "Notification",
      sourceId: "notification-1",
    });
  });

  it.each([
    [{...notification, server_controlled: false}],
    [{...notification, notification_source: "browser"}],
    [{...notification, user_email: "invalid"}],
    [{...notification, message: ""}],
  ])("rejects unsafe or incomplete notification data", (candidate) => {
    expect(buildNotificationEmailRequest("notification-2", candidate)).toBeNull();
  });

  it("records delivery exactly once across duplicate events", async () => {
    const repository = new MemoryRepository();
    const provider = new MockMessageProvider("email");
    const first = await processNotificationDelivery("notification-3", notification, provider, repository);
    const second = await processNotificationDelivery("notification-3", notification, provider, repository);
    expect(first?.delivery.status).toBe("sent");
    expect(first?.duplicate).toBe(false);
    expect(second?.duplicate).toBe(true);
    expect(repository.records.size).toBe(1);
  });
});
`,
    },
    {
      path: 'functions/src/index.ts',
      operations: [{
        type: 'insertBefore',
        anchor: 'export const sendMessageDelivery = onCall(\n',
        content: 'export {\n  deliverNotificationEmail,\n  processNotificationDelivery,\n} from "./notificationDeliveryBridge.js";\n',
      }],
    },
    {
      path: 'package.json',
      operations: [{
        type: 'insertAfter',
        anchor: '    "test:message:callable": "vitest run --no-file-parallelism --testTimeout=30000 tests/message.delivery.callable.test.js",\n',
        content: '    "test:notification:delivery": "vitest run --no-file-parallelism tests/notification.delivery.bridge.test.js",\n',
      }],
    },
    {
      path: '.gitignore',
      operations: [{
        type: 'insertAfter',
        anchor: '*.local\n',
        content: '.patch-engine-backups/\n',
      }],
    },
  ],
};
