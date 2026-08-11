import {createHash} from "node:crypto";

import {
  DocumentData,
  Firestore,
} from "firebase-admin/firestore";

import {
  DeliveryRecord,
  DeliveryRecordRepository,
} from "./messageDeliveryService";

const ROOT_COLLECTION = "system";
const ROOT_DOCUMENT = "messageDeliveries";
const RECORDS_COLLECTION = "records";

/**
 * Produces a stable Firestore-safe document identifier.
 *
 * @param {string} idempotencyKey Delivery idempotency key.
 * @return {string} SHA-256 document identifier.
 */
export function deliveryDocumentId(
  idempotencyKey: string
): string {
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0
  ) {
    throw new Error("A delivery idempotency key is required.");
  }

  return createHash("sha256")
    .update(idempotencyKey.trim(), "utf8")
    .digest("hex");
}

/**
 * Converts stored Firestore data to a delivery record.
 *
 * @param {DocumentData} data Firestore document data.
 * @return {DeliveryRecord} Stored delivery record.
 */
function normalizeDeliveryRecord(
  data: DocumentData
): DeliveryRecord {
  return {
    idempotencyKey: String(data.idempotencyKey || ""),
    channel: data.channel === "sms" ? "sms" : "email",
    status:
      data.status === "processing" ||
      data.status === "sent" ||
      data.status === "failed" ||
      data.status === "skipped" ?
        data.status :
        "failed",
    provider:
      typeof data.provider === "string" ?
        data.provider :
        null,
    reason:
      typeof data.reason === "string" ?
        data.reason :
        null,
    providerMessageId:
      typeof data.providerMessageId === "string" ?
        data.providerMessageId :
        null,
    sourceType:
      typeof data.sourceType === "string" ?
        data.sourceType :
        null,
    sourceId:
      typeof data.sourceId === "string" ?
        data.sourceId :
        null,
    recipientHint:
      typeof data.recipientHint === "string" ?
        data.recipientHint :
        "***",
    attemptCount:
      typeof data.attemptCount === "number" ?
        data.attemptCount :
        0,
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
    nextRetryAt:
      typeof data.nextRetryAt === "string" ?
        data.nextRetryAt :
        null,
  };
}

/**
 * Firestore-backed server-only delivery-record repository.
 */
export class FirestoreDeliveryRecordRepository
implements DeliveryRecordRepository {
  /**
   * Creates the repository.
   *
   * @param {Firestore} firestore Firebase Admin Firestore instance.
   */
  constructor(private readonly firestore: Firestore) {}

  /**
   * Returns the delivery-record collection.
   *
   * @return {*} Firestore collection reference.
   */
  private records() {
    return this.firestore
      .collection(ROOT_COLLECTION)
      .doc(ROOT_DOCUMENT)
      .collection(RECORDS_COLLECTION);
  }

  /**
   * Reads one delivery record.
   *
   * @param {string} idempotencyKey Delivery idempotency key.
   * @return {Promise<DeliveryRecord|null>} Stored record or null.
   */
  async get(
    idempotencyKey: string
  ): Promise<DeliveryRecord | null> {
    const snapshot = await this.records()
      .doc(deliveryDocumentId(idempotencyKey))
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return normalizeDeliveryRecord(
      snapshot.data() || {}
    );
  }

  /**
   * Atomically creates one delivery record if it does not exist.
   *
   * @param {DeliveryRecord} record Delivery record.
   * @return {Promise<boolean>} True when created.
   */
  async create(
    record: DeliveryRecord
  ): Promise<boolean> {
    const reference = this.records().doc(
      deliveryDocumentId(record.idempotencyKey)
    );

    return this.firestore.runTransaction(
      async (transaction) => {
        const existing = await transaction.get(reference);

        if (existing.exists) {
          return false;
        }

        transaction.create(reference, {
          ...record,
          recordVersion: 1,
        });

        return true;
      }
    );
  }

  /**
   * Updates an existing delivery record.
   *
   * @param {string} idempotencyKey Delivery idempotency key.
   * @param {Partial<DeliveryRecord>} changes Record changes.
   * @return {Promise<void>}
   */
  async update(
    idempotencyKey: string,
    changes: Partial<DeliveryRecord>
  ): Promise<void> {
    const reference = this.records().doc(
      deliveryDocumentId(idempotencyKey)
    );

    await reference.update({
      ...changes,
      recordVersion: 1,
    });
  }
}
