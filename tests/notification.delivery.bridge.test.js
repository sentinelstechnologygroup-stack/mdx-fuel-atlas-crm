import {describe, expect, it} from "vitest";
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
