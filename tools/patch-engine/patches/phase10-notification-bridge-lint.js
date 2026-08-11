export default {
  id: 'phase10-notification-bridge-lint',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore',
    'functions/src/index.ts',
    'functions/src/notificationDeliveryBridge.ts',
    'package.json',
    'tests/notification.delivery.bridge.test.js',
  ],
  files: [{
    path: 'functions/src/notificationDeliveryBridge.ts',
    operations: [
      {
        type: 'replace',
        anchor: 'import {FirestoreDeliveryRecordRepository} from "./firestoreDeliveryRepository";\nimport {executeRecordedDelivery, DeliveryExecutionResult, DeliveryRecordRepository} from "./messageDeliveryService";\nimport {createMessagingProvidersFromEnvironment, DeliveryRequest, MessageProvider, MessagingEnvironment} from "./messagingProviders";\n',
        content: 'import {\n  FirestoreDeliveryRecordRepository,\n} from "./firestoreDeliveryRepository";\nimport {\n  executeRecordedDelivery,\n  DeliveryExecutionResult,\n  DeliveryRecordRepository,\n} from "./messageDeliveryService";\nimport {\n  createMessagingProvidersFromEnvironment,\n  DeliveryRequest,\n  MessageProvider,\n  MessagingEnvironment,\n} from "./messagingProviders";\n',
      },
      {
        type: 'insertBefore',
        anchor: 'function readString(',
        content: '/** Reads a trimmed string field. */\n',
      },
      {
        type: 'insertBefore',
        anchor: 'function isEmail(',
        content: '/** Applies a conservative email-address shape check. */\n',
      },
      {
        type: 'insertBefore',
        anchor: 'export function buildNotificationEmailRequest(',
        content: '/** Builds an allowlisted server-notification email request. */\n',
      },
      {
        type: 'insertBefore',
        anchor: 'export async function processNotificationDelivery(',
        content: '/** Executes one idempotently recorded notification delivery. */\n',
      },
      {
        type: 'replace',
        anchor: '  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) && value.length <= 254;\n',
        content: '  return (\n    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) &&\n+    value.length <= 254\n+  );\n',
      },
      {
        type: 'replace',
        anchor: '    const provider = createMessagingProvidersFromEnvironment(environment).email;\n',
        content: '    const provider =\n+      createMessagingProvidersFromEnvironment(\n+        environment\n+      ).email;\n',
      },
      {
        type: 'replace',
        anchor: '    if (result?.record.status === "failed" && result.record.attemptCount < 3) {\n',
        content: '    if (\n+      result?.record.status === "failed" &&\n+      result.record.attemptCount < 3\n+    ) {\n',
      },
    ],
  }],
};
