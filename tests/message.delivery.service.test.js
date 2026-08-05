import {
  calculateNextRetryAt,
  executeRecordedDelivery,
  isDeliveryRetryEligible,
  maskDeliveryRecipient,
} from "../functions/src/messageDeliveryService.ts";

import {
  DisabledMessageProvider,
  MockMessageProvider,
} from "../functions/src/messagingProviders.ts";

import {
  describe,
  expect,
  it,
} from "vitest";

class MemoryDeliveryRepository {
  constructor() {
    this.records = new Map();
  }

  async get(idempotencyKey) {
    return this.records.get(idempotencyKey) || null;
  }

  async create(record) {
    if (this.records.has(record.idempotencyKey)) {
      return false;
    }

    this.records.set(record.idempotencyKey, {
      ...record,
    });

    return true;
  }

  async update(idempotencyKey, changes) {
    const existing =
      this.records.get(idempotencyKey) || {};

    this.records.set(idempotencyKey, {
      ...existing,
      ...changes,
    });
  }
}

class FixedClock {
  constructor(isoTimestamp) {
    this.current = new Date(isoTimestamp);
  }

  now() {
    return new Date(this.current);
  }

  advanceMinutes(minutes) {
    this.current = new Date(
      this.current.getTime() + minutes * 60 * 1000
    );
  }
}

function request(channel) {
  return {
    idempotencyKey: `lead-001-${channel}`,
    recipient: channel === "email" ?
      "salesperson@example.test" :
      "+15555550123",
    subject: channel === "email" ?
      "New lead" :
      undefined,
    message: "A new lead was assigned.",
    sourceType: "Lead",
    sourceId: "lead-001",
  };
}

describe("Phase 9 recorded delivery service", () => {
  it("masks email recipients in delivery records", () => {
    expect(
      maskDeliveryRecipient(
        "email",
        "patrick@example.com"
      )
    ).toBe("p***@example.com");
  });

  it("masks SMS recipients to the final four digits", () => {
    expect(
      maskDeliveryRecipient(
        "sms",
        "+1 (555) 555-0123"
      )
    ).toBe("***0123");
  });

  it("records successful delivery exactly once", async () => {
    const repository = new MemoryDeliveryRepository();
    const provider = new MockMessageProvider("email");
    const clock = new FixedClock(
      "2026-08-05T18:00:00.000Z"
    );

    const first = await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    const second = await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    expect(first.duplicate).toBe(false);
    expect(first.record.status).toBe("sent");
    expect(first.record.attemptCount).toBe(1);
    expect(second.duplicate).toBe(true);
    expect(second.record.attemptCount).toBe(1);
  });

  it("records disabled providers as skipped", async () => {
    const repository = new MemoryDeliveryRepository();

    const result = await executeRecordedDelivery(
      new DisabledMessageProvider("sms"),
      request("sms"),
      repository,
      new FixedClock("2026-08-05T18:00:00.000Z")
    );

    expect(result.record).toMatchObject({
      status: "skipped",
      provider: null,
      reason: "provider_not_configured",
      attemptCount: 1,
    });
  });

  it("records failures with retry metadata", async () => {
    const repository = new MemoryDeliveryRepository();
    const clock = new FixedClock(
      "2026-08-05T18:00:00.000Z"
    );

    const result = await executeRecordedDelivery(
      new MockMessageProvider("email", "failed"),
      request("email"),
      repository,
      clock
    );

    expect(result.record.status).toBe("failed");
    expect(result.record.attemptCount).toBe(1);
    expect(result.record.nextRetryAt)
      .toBe("2026-08-05T18:05:00.000Z");
  });

  it("blocks retry before the retry time", async () => {
    const repository = new MemoryDeliveryRepository();
    const clock = new FixedClock(
      "2026-08-05T18:00:00.000Z"
    );
    const provider =
      new MockMessageProvider("email", "failed");

    await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    const second = await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    expect(second.duplicate).toBe(true);
    expect(second.record.attemptCount).toBe(1);
  });

  it("allows retry once the retry time is reached", async () => {
    const repository = new MemoryDeliveryRepository();
    const clock = new FixedClock(
      "2026-08-05T18:00:00.000Z"
    );
    const provider =
      new MockMessageProvider("email", "failed");

    await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    clock.advanceMinutes(5);

    const second = await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    expect(second.duplicate).toBe(false);
    expect(second.record.attemptCount).toBe(2);
    expect(second.record.nextRetryAt)
      .toBe("2026-08-05T18:15:00.000Z");
  });

  it("stops automatic retries after three attempts", async () => {
    const repository = new MemoryDeliveryRepository();
    const clock = new FixedClock(
      "2026-08-05T18:00:00.000Z"
    );
    const provider =
      new MockMessageProvider("email", "failed");

    await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    clock.advanceMinutes(5);

    await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    clock.advanceMinutes(10);

    const third = await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    clock.advanceMinutes(60);

    const fourth = await executeRecordedDelivery(
      provider,
      request("email"),
      repository,
      clock
    );

    expect(third.record.attemptCount).toBe(3);
    expect(third.record.nextRetryAt).toBeNull();
    expect(fourth.duplicate).toBe(true);
    expect(fourth.record.attemptCount).toBe(3);
  });

  it("calculates bounded exponential retry times", () => {
    const now = new Date("2026-08-05T18:00:00.000Z");

    expect(calculateNextRetryAt(now, 1))
      .toBe("2026-08-05T18:05:00.000Z");

    expect(calculateNextRetryAt(now, 2))
      .toBe("2026-08-05T18:10:00.000Z");

    expect(calculateNextRetryAt(now, 3))
      .toBeNull();
  });

  it("only retries eligible failed records", () => {
    const now = new Date("2026-08-05T18:10:00.000Z");

    expect(
      isDeliveryRetryEligible(
        {
          idempotencyKey: "test",
          channel: "email",
          status: "failed",
          provider: "mock",
          reason: "failure",
          providerMessageId: null,
          sourceType: null,
          sourceId: null,
          recipientHint: "p***@example.test",
          attemptCount: 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          nextRetryAt: "2026-08-05T18:05:00.000Z",
        },
        now
      )
    ).toBe(true);
  });
});
