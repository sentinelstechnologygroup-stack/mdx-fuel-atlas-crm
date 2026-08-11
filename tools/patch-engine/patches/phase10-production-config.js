export default {
  id: 'phase10-production-config',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore', 'functions/src/automation.ts', 'functions/src/index.ts',
    'functions/src/notificationDeliveryBridge.ts', 'package.json',
    'src/components/common/FileUpload.jsx',
    'src/components/cs/ClientDetails.jsx',
    'src/firebase/attachmentMetadata.js',
    'src/firebase/storageService.js', 'storage.rules',
    'tests/attachment.metadata.test.js',
    'tests/automation.messaging.test.js',
    'tests/functions.automationTrigger.emulator.test.js',
    'tests/notification.delivery.bridge.test.js',
    'tests/storage.rules.test.js',
  ],
  files: [
    {
      path: 'functions/src/messagingRuntimeConfig.ts',
      create: true,
      content: `import {
  defineSecret,
  defineString,
} from "firebase-functions/params";

import {
  MessagingEnvironment,
} from "./messagingProviders";

export const resendApiKey = defineSecret(
  "RESEND_API_KEY",
  {description: "Resend API credential."}
);

export const twilioAuthToken = defineSecret(
  "TWILIO_AUTH_TOKEN",
  {description: "Twilio API authentication token."}
);

const resendFromEmail = defineString(
  "RESEND_FROM_EMAIL",
  {description: "Verified Resend sender address."}
);

const resendReplyTo = defineString(
  "RESEND_REPLY_TO",
  {
    description: "Optional reply-to address for CRM email.",
    default: "",
  }
);

const twilioAccountSid = defineString(
  "TWILIO_ACCOUNT_SID",
  {description: "Twilio account identifier."}
);

const twilioFromNumber = defineString(
  "TWILIO_FROM_NUMBER",
  {description: "Twilio sender phone number."}
);

export const EMAIL_MESSAGING_SECRETS = [
  resendApiKey,
];

export const ALL_MESSAGING_SECRETS = [
  resendApiKey,
  twilioAuthToken,
];

export function emailMessagingEnvironment(): MessagingEnvironment {
  return {
    RESEND_API_KEY: resendApiKey.value(),
    RESEND_FROM_EMAIL: resendFromEmail.value(),
    RESEND_REPLY_TO: resendReplyTo.value() || undefined,
  };
}

export function messagingEnvironment(): MessagingEnvironment {
  return {
    ...emailMessagingEnvironment(),
    TWILIO_ACCOUNT_SID: twilioAccountSid.value(),
    TWILIO_AUTH_TOKEN: twilioAuthToken.value(),
    TWILIO_FROM_NUMBER: twilioFromNumber.value(),
  };
}
`,
    },
    {
      path: 'functions/src/notificationDeliveryBridge.ts',
      operations: [
        {
          type: 'insertAfter',
          anchor: '} from "./messagingProviders";\n',
          content: 'import {\n  EMAIL_MESSAGING_SECRETS,\n  emailMessagingEnvironment,\n} from "./messagingRuntimeConfig";\n',
        },
        {
          type: 'delete',
          anchor: '  MessagingEnvironment,\n',
        },
        {
          type: 'insertAfter',
          anchor: '    retry: true,\n',
          content: '    secrets: EMAIL_MESSAGING_SECRETS,\n',
        },
        {
          type: 'replace',
          anchor: '    const environment: MessagingEnvironment = {\n      RESEND_API_KEY: process.env.RESEND_API_KEY,\n      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,\n      RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,\n    };\n',
          content: '    const environment = emailMessagingEnvironment();\n',
        },
      ],
    },
    {
      path: 'functions/src/automation.ts',
      operations: [
        {
          type: 'insertAfter',
          anchor: '} from "./messagingProviders";\n',
          content: 'import {\n  EMAIL_MESSAGING_SECRETS,\n  emailMessagingEnvironment,\n} from "./messagingRuntimeConfig";\n',
        },
        {
          type: 'delete',
          anchor: '  MessagingEnvironment,\n',
        },
        {
          type: 'replace',
          anchor: '  const environment: MessagingEnvironment = {\n    RESEND_API_KEY: process.env.RESEND_API_KEY,\n    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,\n    RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,\n  };\n',
          content: '  const environment = emailMessagingEnvironment();\n',
        },
        {
          type: 'replace',
          anchor: '  onDocumentWritten(\n    "entities/{entityName}/records/{recordId}",\n',
          content: '  onDocumentWritten(\n    {\n      document: "entities/{entityName}/records/{recordId}",\n      region: "us-central1",\n      secrets: EMAIL_MESSAGING_SECRETS,\n    },\n',
        },
      ],
    },
    {
      path: 'functions/src/index.ts',
      operations: [
        {
          type: 'insertAfter',
          anchor: '} from "./messageDeliveryCallable";\n',
          content: 'import {\n  ALL_MESSAGING_SECRETS,\n  messagingEnvironment,\n} from "./messagingRuntimeConfig";\n',
        },
        {
          type: 'replace',
          anchor: 'export const sendMessageDelivery = onCall(\n  async (request) => {\n',
          content: 'export const sendMessageDelivery = onCall(\n  {\n    region: "us-central1",\n    secrets: ALL_MESSAGING_SECRETS,\n  },\n  async (request) => {\n',
        },
        {
          type: 'replace',
          anchor: '        environment: {\n          RESEND_API_KEY:\n            process.env.RESEND_API_KEY,\n          RESEND_FROM_EMAIL:\n            process.env.RESEND_FROM_EMAIL,\n          RESEND_REPLY_TO:\n            process.env.RESEND_REPLY_TO,\n          TWILIO_ACCOUNT_SID:\n            process.env.TWILIO_ACCOUNT_SID,\n          TWILIO_AUTH_TOKEN:\n            process.env.TWILIO_AUTH_TOKEN,\n          TWILIO_FROM_NUMBER:\n            process.env.TWILIO_FROM_NUMBER,\n        },\n',
          content: '        environment: messagingEnvironment(),\n',
        },
      ],
    },
    {
      path: 'tests/messaging.runtime.config.test.js',
      create: true,
      content: `import {afterEach, describe, expect, it} from "vitest";
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
`,
    },
    {
      path: 'package.json',
      operations: [{
        type: 'insertAfter',
        anchor: '    "test:attachment:metadata": "vitest run --no-file-parallelism tests/attachment.metadata.test.js",\n',
        content: '    "test:messaging:runtime-config": "vitest run --no-file-parallelism tests/messaging.runtime.config.test.js",\n',
      }],
    },
    {
      path: 'tools/patch-engine/README.md',
      operations: [{
        type: 'insertBefore',
        anchor: '```powershell\n',
        content: '## Production secret boundary\n\nPatch definitions may declare secret bindings in source, but they must never contain secret values or invoke deployment/secret-management commands.\n\n',
      }],
    },
  ],
};
