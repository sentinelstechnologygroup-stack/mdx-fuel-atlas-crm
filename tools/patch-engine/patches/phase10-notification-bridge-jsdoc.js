export default {
  id: 'phase10-notification-bridge-jsdoc',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: ['.gitignore', 'functions/src/index.ts', 'functions/src/notificationDeliveryBridge.ts', 'package.json', 'tests/notification.delivery.bridge.test.js'],
  files: [{
    path: 'functions/src/notificationDeliveryBridge.ts',
    operations: [
      {type: 'replace', anchor: '/** Reads a trimmed string field. */\n', content: '/**\n * Reads a trimmed string field.\n * @param {NotificationData} data Source notification.\n * @param {string} key Field name.\n * @return {string|null} Trimmed value or null.\n */\n'},
      {type: 'replace', anchor: '/** Applies a conservative email-address shape check. */\n', content: '/**\n * Applies a conservative email-address shape check.\n * @param {string} value Candidate address.\n * @return {boolean} Whether the address is acceptable.\n */\n'},
      {type: 'replace', anchor: '/** Builds an allowlisted server-notification email request. */\n', content: '/**\n * Builds an allowlisted server-notification email request.\n * @param {string} notificationId Notification document ID.\n * @param {NotificationData} notification Stored notification.\n * @return {DeliveryRequest|null} Delivery request or null.\n */\n'},
      {type: 'replace', anchor: '/** Executes one idempotently recorded notification delivery. */\n', content: '/**\n * Executes one idempotently recorded notification delivery.\n * @param {string} notificationId Notification document ID.\n * @param {NotificationData} notification Stored notification.\n * @param {MessageProvider} provider Server-owned provider.\n * @param {DeliveryRecordRepository} repository Record repository.\n * @return {Promise<DeliveryExecutionResult|null>} Delivery result.\n */\n'},
    ],
  }],
};
