import {
  DeliveryChannel,
  DeliveryRequest,
  DeliveryResult,
  MessageProvider,
} from "./messagingProviders";

export type DeliveryRecordStatus =
  | "processing"
  | "sent"
  | "failed"
  | "skipped";

export interface DeliveryRecord {
  idempotencyKey: string;
  channel: DeliveryChannel;
  status: DeliveryRecordStatus;
  provider: string | null;
  reason: string | null;
  providerMessageId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  recipientHint: string;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  nextRetryAt: string | null;
}

export interface DeliveryRecordRepository {
  get(
    idempotencyKey: string
  ): Promise<DeliveryRecord | null>;

  create(
    record: DeliveryRecord
  ): Promise<boolean>;

  update(
    idempotencyKey: string,
    changes: Partial<DeliveryRecord>
  ): Promise<void>;
}

export interface DeliveryExecutionResult {
  duplicate: boolean;
  record: DeliveryRecord;
  delivery: DeliveryResult;
}

export interface DeliveryClock {
  now(): Date;
}

const MAX_AUTOMATIC_ATTEMPTS = 3;

/**
 * Default system clock.
 */
export class SystemDeliveryClock implements DeliveryClock {
  /**
   * Returns the current time.
   *
   * @return {Date} Current time.
   */
  now(): Date {
    return new Date();
  }
}

/**
 * Produces an audit-safe recipient hint.
 *
 * @param {DeliveryChannel} channel Delivery channel.
 * @param {string} recipient Delivery recipient.
 * @return {string} Masked recipient hint.
 */
export function maskDeliveryRecipient(
  channel: DeliveryChannel,
  recipient: string
): string {
  const normalized = recipient.trim();

  if (channel === "email") {
    const separatorIndex = normalized.indexOf("@");

    if (separatorIndex <= 0) {
      return "***";
    }

    const local = normalized.slice(0, separatorIndex);
    const domain = normalized.slice(separatorIndex + 1);
    const visibleLocal = local.slice(0, 1);

    return `${visibleLocal}***@${domain}`;
  }

  const digits = normalized.replace(/\D/g, "");
  const finalDigits = digits.slice(-4);

  return finalDigits.length > 0 ?
    `***${finalDigits}` :
    "***";
}

/**
 * Determines whether a failed delivery may be retried.
 *
 * @param {DeliveryRecord} record Delivery record.
 * @param {Date} now Current time.
 * @return {boolean} True when retry is eligible.
 */
export function isDeliveryRetryEligible(
  record: DeliveryRecord,
  now: Date
): boolean {
  if (record.status !== "failed") {
    return false;
  }

  if (record.attemptCount >= MAX_AUTOMATIC_ATTEMPTS) {
    return false;
  }

  if (!record.nextRetryAt) {
    return true;
  }

  const retryTime = new Date(record.nextRetryAt);

  return Number.isFinite(retryTime.getTime()) &&
    retryTime.getTime() <= now.getTime();
}

/**
 * Calculates an exponential retry time.
 *
 * @param {Date} now Current time.
 * @param {number} attemptCount Completed attempt count.
 * @return {string|null} Next retry time or null.
 */
export function calculateNextRetryAt(
  now: Date,
  attemptCount: number
): string | null {
  if (attemptCount >= MAX_AUTOMATIC_ATTEMPTS) {
    return null;
  }

  const delayMinutes = Math.pow(2, attemptCount - 1) * 5;
  const retryAt = new Date(
    now.getTime() + delayMinutes * 60 * 1000
  );

  return retryAt.toISOString();
}

/**
 * Creates a normalized delivery result from an existing record.
 *
 * @param {DeliveryRecord} record Existing record.
 * @return {DeliveryResult} Provider-independent delivery result.
 */
function deliveryResultFromRecord(
  record: DeliveryRecord
): DeliveryResult {
  return {
    channel: record.channel,
    status: record.status === "processing" ?
      "failed" :
      record.status,
    provider: record.provider,
    reason: record.status === "processing" ?
      "delivery_already_processing" :
      record.reason,
    idempotencyKey: record.idempotencyKey,
    providerMessageId: record.providerMessageId,
  };
}

/**
 * Executes one delivery with idempotency and retry metadata.
 *
 * @param {MessageProvider} provider Message provider.
 * @param {DeliveryRequest} request Delivery request.
 * @param {DeliveryRecordRepository} repository Record repository.
 * @param {DeliveryClock} clock Time provider.
 * @return {Promise<DeliveryExecutionResult>} Execution result.
 */
export async function executeRecordedDelivery(
  provider: MessageProvider,
  request: DeliveryRequest,
  repository: DeliveryRecordRepository,
  clock: DeliveryClock = new SystemDeliveryClock()
): Promise<DeliveryExecutionResult> {
  const existing = await repository.get(
    request.idempotencyKey
  );

  if (
    existing &&
    (
      existing.status === "sent" ||
      existing.status === "skipped" ||
      existing.status === "processing" ||
      !isDeliveryRetryEligible(existing, clock.now())
    )
  ) {
    return {
      duplicate: true,
      record: existing,
      delivery: deliveryResultFromRecord(existing),
    };
  }

  const now = clock.now();
  const attemptCount = (existing?.attemptCount || 0) + 1;

  const processingRecord: DeliveryRecord = {
    idempotencyKey: request.idempotencyKey,
    channel: provider.channel,
    status: "processing",
    provider: provider.name,
    reason: null,
    providerMessageId: null,
    sourceType: request.sourceType || null,
    sourceId: request.sourceId || null,
    recipientHint: maskDeliveryRecipient(
      provider.channel,
      request.recipient
    ),
    attemptCount,
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    nextRetryAt: null,
  };

  if (existing) {
    await repository.update(
      request.idempotencyKey,
      processingRecord
    );
  } else {
    const created = await repository.create(
      processingRecord
    );

    if (!created) {
      const competingRecord = await repository.get(
        request.idempotencyKey
      );

      if (!competingRecord) {
        throw new Error(
          "Delivery record contention could not be resolved."
        );
      }

      return {
        duplicate: true,
        record: competingRecord,
        delivery: deliveryResultFromRecord(competingRecord),
      };
    }
  }

  let delivery: DeliveryResult;

  try {
    delivery = await provider.send(request);
  } catch {
    delivery = {
      channel: provider.channel,
      status: "failed",
      provider: provider.name,
      reason: "provider_exception",
      idempotencyKey: request.idempotencyKey,
      providerMessageId: null,
    };
  }

  const completedAt = clock.now();
  const status: DeliveryRecordStatus =
    delivery.status === "queued" ?
      "processing" :
      delivery.status;

  const completedRecord: DeliveryRecord = {
    ...processingRecord,
    status,
    provider: delivery.provider,
    reason: delivery.reason,
    providerMessageId: delivery.providerMessageId,
    updatedAt: completedAt.toISOString(),
    nextRetryAt: status === "failed" ?
      calculateNextRetryAt(completedAt, attemptCount) :
      null,
  };

  await repository.update(
    request.idempotencyKey,
    completedRecord
  );

  return {
    duplicate: false,
    record: completedRecord,
    delivery,
  };
}
