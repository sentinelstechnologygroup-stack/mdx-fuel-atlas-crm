import {getFirestore} from "firebase-admin/firestore";
import {onDocumentCreated} from "firebase-functions/v2/firestore";

import {
  FirestoreDeliveryRecordRepository,
} from "./firestoreDeliveryRepository";
import {
  executeRecordedDelivery,
  DeliveryExecutionResult,
  DeliveryRecordRepository,
} from "./messageDeliveryService";
import {
  createMessagingProvidersFromEnvironment,
  DeliveryRequest,
  MessageProvider,
} from "./messagingProviders";
import {
  EMAIL_MESSAGING_SECRETS,
  emailMessagingEnvironment,
} from "./messagingRuntimeConfig";

type NotificationData = Record<string, unknown>;

const SUPPORTED_SOURCES = new Set([
  "lead_on_create",
  "daily_reminder_processor",
]);

/**
 * Reads a trimmed string field.
 * @param {NotificationData} data Source notification.
 * @param {string} key Field name.
 * @return {string|null} Trimmed value or null.
 */
function readString(data: NotificationData, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Applies a conservative email-address shape check.
 * @param {string} value Candidate address.
 * @return {boolean} Whether the address is acceptable.
 */
function isEmail(value: string): boolean {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    value.length <= 254
  );
}

/**
 * Builds an allowlisted server-notification email request.
 * @param {string} notificationId Notification document ID.
 * @param {NotificationData} notification Stored notification.
 * @return {DeliveryRequest|null} Delivery request or null.
 */
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
    idempotencyKey: `notification:${notificationId}:email`,
    recipient,
    subject: title.slice(0, 200),
    message: message.slice(0, 10000),
    sourceType: "Notification",
    sourceId: notificationId,
  };
}

/**
 * Executes one idempotently recorded notification delivery.
 * @param {string} notificationId Notification document ID.
 * @param {NotificationData} notification Stored notification.
 * @param {MessageProvider} provider Server-owned provider.
 * @param {DeliveryRecordRepository} repository Record repository.
 * @return {Promise<DeliveryExecutionResult|null>} Delivery result.
 */
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
    secrets: EMAIL_MESSAGING_SECRETS,
  },
  async (event) => {
    if (!event.data) return;
    const firestore = getFirestore();
    const environment = emailMessagingEnvironment();
    const provider =
      createMessagingProvidersFromEnvironment(
        environment
      ).email;
    const repository = new FirestoreDeliveryRecordRepository(firestore);
    const result = await processNotificationDelivery(
      event.params.notificationId,
      event.data.data() as NotificationData,
      provider,
      repository
    );
    if (
      result?.record.status === "failed" &&
      result.record.attemptCount < 3
    ) {
      throw new Error("Notification email delivery will be retried.");
    }
  }
);
