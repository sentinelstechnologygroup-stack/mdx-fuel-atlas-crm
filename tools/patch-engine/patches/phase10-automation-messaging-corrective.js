export default {
  id: 'phase10-automation-messaging-corrective',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore', 'functions/src/automation.ts', 'functions/src/index.ts',
    'functions/src/notificationDeliveryBridge.ts', 'package.json',
    'tests/automation.messaging.test.js',
    'tests/notification.delivery.bridge.test.js',
  ],
  files: [{
    path: 'functions/src/automation.ts',
    operations: [{
      type: 'replace',
      anchor: '\n+export function buildAutomationEmailRequest(',
      content: '\nexport function buildAutomationEmailRequest(',
    }],
  }],
};
