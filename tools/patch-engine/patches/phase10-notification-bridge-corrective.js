export default {
  id: 'phase10-notification-bridge-corrective',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore', 'functions/src/index.ts',
    'functions/src/notificationDeliveryBridge.ts', 'package.json',
    'tests/notification.delivery.bridge.test.js',
  ],
  files: [{
    path: 'functions/src/notificationDeliveryBridge.ts',
    operations: [
      {type: 'replace', anchor: '\n+    value.length <= 254\n+  );', content: '\n    value.length <= 254\n  );'},
      {type: 'replace', anchor: '\n+      createMessagingProvidersFromEnvironment(\n+        environment\n+      ).email;', content: '\n      createMessagingProvidersFromEnvironment(\n        environment\n      ).email;'},
      {type: 'replace', anchor: '\n+      result?.record.status === "failed" &&\n+      result.record.attemptCount < 3\n+    ) {', content: '\n      result?.record.status === "failed" &&\n      result.record.attemptCount < 3\n    ) {'},
    ],
  }],
};
