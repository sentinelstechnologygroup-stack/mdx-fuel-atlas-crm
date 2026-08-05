import {
  Firestore,
} from "firebase-admin/firestore";

import {
  HttpsError,
} from "firebase-functions/v2/https";

import {
  FirestoreDeliveryRecordRepository,
} from "./firestoreDeliveryRepository";

import {
  executeRecordedDelivery,
} from "./messageDeliveryService";

import {
  createMessagingProvidersFromEnvironment,
  DeliveryChannel,
  DeliveryRequest,
  MessagingEnvironment,
} from "./messagingProviders";

type ActorProfile = Record<string, unknown>;

export interface MessageDeliveryActor {
  uid: string;
  role: string;
  status: string;
}

export interface MessageDeliveryInput {
  channel?: unknown;
  recipient?: unknown;
  subject?: unknown;
  message?: unknown;
  sourceType?: unknown;
  sourceId?: unknown;
  eventKey?: unknown;
  replyTo?: unknown;
}

export interface MessageDeliveryDependencies {
  firestore: Firestore;
  environment: MessagingEnvironment;
}

const ALLOWED_SOURCE_TYPES = new Set([
  "Lead",
  "Opportunity",
  "Client",
  "Task",
  "Activity",
  "Automation",
  "Notification",
]);

/**
 * Reads the first populated string from an object.
 *
 * @param {Record<string, unknown>} data Source data.
 * @param {...string} keys Candidate keys.
 * @return {string|null} Populated string or null.
 */
function readString(
  data: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = data[key];

    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      return value.trim();
    }
  }

  return null;
}

/**
 * Normalizes one ATLAS application role.
 *
 * @param {ActorProfile} profile Stored actor profile.
 * @return {string} Canonical role.
 */
function normalizeRole(profile: ActorProfile): string {
  const role = readString(
    profile,
    "application_role",
    "appRole",
    "role"
  );

  return role === "admin" ? "administrator" : role || "";
}

/**
 * Normalizes one ATLAS account status.
 *
 * @param {ActorProfile} profile Stored actor profile.
 * @return {string} Canonical account status.
 */
function normalizeStatus(profile: ActorProfile): string {
  const status = readString(
    profile,
    "account_status",
    "accountStatus",
    "status"
  );

  if (status) {
    return status;
  }

  return profile.active === false ? "inactive" : "active";
}

/**
 * Loads and verifies an active authenticated ATLAS actor.
 *
 * @param {Firestore} firestore Firestore instance.
 * @param {string|undefined} uid Authenticated user identifier.
 * @return {Promise<MessageDeliveryActor>} Verified actor.
 */
export async function requireMessageDeliveryActor(
  firestore: Firestore,
  uid: string | undefined
): Promise<MessageDeliveryActor> {
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
  const status = normalizeStatus(profile);

  if (status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "The ATLAS employee account is not active."
    );
  }

  return {
    uid,
    role: normalizeRole(profile),
    status,
  };
}

/**
 * Validates and normalizes one server-controlled delivery request.
 *
 * The browser may supply the intended recipient and message content,
 * but it cannot provide provider credentials, provider names, sender
 * identities, attempt counts, statuses, or provider message IDs.
 *
 * @param {MessageDeliveryInput} input Callable request data.
 * @return {{channel: DeliveryChannel, request: DeliveryRequest}}
 * Normalized delivery request.
 */
export function normalizeMessageDeliveryInput(
  input: MessageDeliveryInput
): {
  channel: DeliveryChannel;
  request: DeliveryRequest;
} {
  const channel =
    input.channel === "email" || input.channel === "sms" ?
      input.channel :
      null;

  if (!channel) {
    throw new HttpsError(
      "invalid-argument",
      "A valid delivery channel is required."
    );
  }

  const recipient =
    typeof input.recipient === "string" ?
      input.recipient.trim() :
      "";

  const message =
    typeof input.message === "string" ?
      input.message.trim() :
      "";

  const sourceType =
    typeof input.sourceType === "string" ?
      input.sourceType.trim() :
      "";

  const sourceId =
    typeof input.sourceId === "string" ?
      input.sourceId.trim() :
      "";

  const eventKey =
    typeof input.eventKey === "string" ?
      input.eventKey.trim() :
      "";

  if (!recipient) {
    throw new HttpsError(
      "invalid-argument",
      "A delivery recipient is required."
    );
  }

  if (!message) {
    throw new HttpsError(
      "invalid-argument",
      "A delivery message is required."
    );
  }

  if (
    !sourceType ||
    !ALLOWED_SOURCE_TYPES.has(sourceType)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A supported CRM source type is required."
    );
  }

  if (!sourceId) {
    throw new HttpsError(
      "invalid-argument",
      "A CRM source identifier is required."
    );
  }

  if (!eventKey) {
    throw new HttpsError(
      "invalid-argument",
      "A stable event key is required."
    );
  }

  const subject =
    typeof input.subject === "string" ?
      input.subject.trim() :
      "";

  if (channel === "email" && !subject) {
    throw new HttpsError(
      "invalid-argument",
      "An email subject is required."
    );
  }

  const idempotencyKey = [
    sourceType.toLowerCase(),
    sourceId,
    eventKey,
    channel,
  ].join(":");

  return {
    channel,
    request: {
      idempotencyKey,
      recipient,
      message,
      subject: channel === "email" ? subject : undefined,
      sourceType,
      sourceId,
      replyTo:
        typeof input.replyTo === "string" ?
          input.replyTo.trim() :
          undefined,
    },
  };
}

/**
 * Executes one authenticated server-side delivery request.
 *
 * @param {MessageDeliveryDependencies} dependencies Server dependencies.
 * @param {string|undefined} actorUid Authenticated actor identifier.
 * @param {MessageDeliveryInput} input Callable input.
 * @return {Promise<Record<string, unknown>>} Public delivery result.
 */
export async function executeMessageDeliveryCallable(
  dependencies: MessageDeliveryDependencies,
  actorUid: string | undefined,
  input: MessageDeliveryInput
): Promise<Record<string, unknown>> {
  const actor = await requireMessageDeliveryActor(
    dependencies.firestore,
    actorUid
  );

  const normalized = normalizeMessageDeliveryInput(input);

  const providers = createMessagingProvidersFromEnvironment(
    dependencies.environment
  );

  const provider = normalized.channel === "email" ?
    providers.email :
    providers.sms;

  const repository =
    new FirestoreDeliveryRecordRepository(
      dependencies.firestore
    );

  const result = await executeRecordedDelivery(
    provider,
    normalized.request,
    repository
  );

  return {
    channel: result.delivery.channel,
    status: result.delivery.status,
    provider: result.delivery.provider,
    reason: result.delivery.reason,
    providerMessageId:
      result.delivery.providerMessageId,
    idempotencyKey:
      result.delivery.idempotencyKey,
    duplicate: result.duplicate,
    attemptCount: result.record.attemptCount,
    recipientHint: result.record.recipientHint,
    sourceType: result.record.sourceType,
    sourceId: result.record.sourceId,
    requestedBy: actor.uid,
  };
}
