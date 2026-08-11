import {
  createDisabledMessagingProviders,
  createMessagingProvidersFromEnvironment,
  deliverOptionalMessages,
  DisabledMessageProvider,
  MockMessageProvider,
  ResendEmailProvider,
  TwilioSmsProvider,
} from "../functions/src/messagingProviders.ts";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

function requests() {
  return {
    email: {
      idempotencyKey: "lead-001-email",
      recipient: "sales@example.test",
      subject: "New lead",
      message: "A new lead was assigned.",
    },
    sms: {
      idempotencyKey: "lead-001-sms",
      recipient: "+15555550100",
      message: "A new lead was assigned.",
    },
  };
}

function mockResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe("Phase 9 optional messaging providers", () => {
  it("works with neither provider configured", async () => {
    const result = await deliverOptionalMessages(
      createDisabledMessagingProviders(),
      requests()
    );

    expect(result.email.status).toBe("skipped");
    expect(result.sms.status).toBe("skipped");
  });

  it("allows email without SMS", async () => {
    const result = await deliverOptionalMessages(
      {
        email: new MockMessageProvider("email"),
        sms: new DisabledMessageProvider("sms"),
      },
      requests()
    );

    expect(result.email.status).toBe("sent");
    expect(result.sms.status).toBe("skipped");
  });

  it("allows SMS without email", async () => {
    const result = await deliverOptionalMessages(
      {
        email: new DisabledMessageProvider("email"),
        sms: new MockMessageProvider("sms"),
      },
      requests()
    );

    expect(result.email.status).toBe("skipped");
    expect(result.sms.status).toBe("sent");
  });

  it("does not block SMS when email fails", async () => {
    const result = await deliverOptionalMessages(
      {
        email: new MockMessageProvider("email", "failed"),
        sms: new MockMessageProvider("sms"),
      },
      requests()
    );

    expect(result.email.status).toBe("failed");
    expect(result.sms.status).toBe("sent");
  });

  it("does not block email when SMS fails", async () => {
    const result = await deliverOptionalMessages(
      {
        email: new MockMessageProvider("email"),
        sms: new MockMessageProvider("sms", "failed"),
      },
      requests()
    );

    expect(result.email.status).toBe("sent");
    expect(result.sms.status).toBe("failed");
  });

  it("preserves idempotency keys", async () => {
    const input = requests();

    const result = await deliverOptionalMessages(
      createDisabledMessagingProviders(),
      input
    );

    expect(result.email.idempotencyKey)
      .toBe(input.email.idempotencyKey);

    expect(result.sms.idempotencyKey)
      .toBe(input.sms.idempotencyKey);
  });

  it("keeps both providers disabled with missing secrets", () => {
    const providers =
      createMessagingProvidersFromEnvironment({});

    expect(providers.email.availability).toBe("disabled");
    expect(providers.sms.availability).toBe("disabled");
  });

  it("configures email independently from SMS", () => {
    const providers =
      createMessagingProvidersFromEnvironment({
        RESEND_API_KEY: "test-resend-key",
        RESEND_FROM_EMAIL: "alerts@example.test",
      });

    expect(providers.email.name).toBe("resend");
    expect(providers.sms.availability).toBe("disabled");
  });

  it("configures SMS independently from email", () => {
    const providers =
      createMessagingProvidersFromEnvironment({
        TWILIO_ACCOUNT_SID: "AC123",
        TWILIO_AUTH_TOKEN: "test-token",
        TWILIO_FROM_NUMBER: "+15555550199",
      });

    expect(providers.email.availability).toBe("disabled");
    expect(providers.sms.name).toBe("twilio");
  });

  it("sends Resend email through a mocked HTTPS request", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(
      mockResponse({id: "resend-message-001"})
    );

    const provider = new ResendEmailProvider(
      "test-key",
      "alerts@example.test",
      null,
      mockedFetch
    );

    const result = await provider.send(requests().email);

    expect(result).toMatchObject({
      status: "sent",
      provider: "resend",
      providerMessageId: "resend-message-001",
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("requires an email subject without throwing", async () => {
    const mockedFetch = vi.fn();

    const provider = new ResendEmailProvider(
      "test-key",
      "alerts@example.test",
      null,
      mockedFetch
    );

    const result = await provider.send({
      ...requests().email,
      subject: "",
    });

    expect(result.reason).toBe("email_subject_required");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("sends Twilio SMS through a mocked HTTPS request", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(
      mockResponse({sid: "SM001"})
    );

    const provider = new TwilioSmsProvider(
      "AC123",
      "test-token",
      "+15555550199",
      mockedFetch
    );

    const result = await provider.send(requests().sms);

    expect(result).toMatchObject({
      status: "sent",
      provider: "twilio",
      providerMessageId: "SM001",
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("returns controlled failures for provider HTTP errors", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(
      mockResponse({}, 503)
    );

    const email = new ResendEmailProvider(
      "test-key",
      "alerts@example.test",
      null,
      mockedFetch
    );

    const result = await email.send(requests().email);

    expect(result).toMatchObject({
      status: "failed",
      reason: "provider_http_503",
    });
  });
});
