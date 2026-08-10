import {afterEach, describe, expect, it} from "vitest";
import {
  ALL_MESSAGING_SECRETS,
  EMAIL_MESSAGING_SECRETS,
  emailMessagingEnvironment,
  messagingEnvironment,
} from "../functions/src/messagingRuntimeConfig.ts";
import {
  createMessagingProvidersFromEnvironment,
} from "../functions/src/messagingProviders.ts";

const NAMES = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_REPLY_TO",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
];

const original = Object.fromEntries(
  NAMES.map((name) => [name, process.env[name]])
);

afterEach(() => {
  for (const name of NAMES) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
});

describe("Phase 10 messaging runtime configuration", () => {
  it("binds only provider credentials as secrets", () => {
    expect(EMAIL_MESSAGING_SECRETS.map(({name}) => name))
      .toEqual(["RESEND_API_KEY"]);
    expect(ALL_MESSAGING_SECRETS.map(({name}) => name))
      .toEqual(["RESEND_API_KEY", "TWILIO_AUTH_TOKEN"]);
  });

  it("keeps missing local configuration safely disabled", () => {
    for (const name of NAMES) delete process.env[name];

    const providers = createMessagingProvidersFromEnvironment(
      messagingEnvironment()
    );

    expect(providers.email.availability).toBe("disabled");
    expect(providers.sms.availability).toBe("disabled");
  });

  it("resolves email and SMS runtime parameters", () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.RESEND_FROM_EMAIL = "crm@example.test";
    process.env.RESEND_REPLY_TO = "reply@example.test";
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "test-twilio-token";
    process.env.TWILIO_FROM_NUMBER = "+12815550100";

    expect(emailMessagingEnvironment()).toEqual({
      RESEND_API_KEY: "test-resend-key",
      RESEND_FROM_EMAIL: "crm@example.test",
      RESEND_REPLY_TO: "reply@example.test",
    });
    expect(messagingEnvironment()).toMatchObject({
      TWILIO_ACCOUNT_SID: "ACtest",
      TWILIO_AUTH_TOKEN: "test-twilio-token",
      TWILIO_FROM_NUMBER: "+12815550100",
    });
  });
});
