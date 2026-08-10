export default {
  id: 'phase10-production-config-jsdoc-return',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore', 'functions/src/automation.ts', 'functions/src/index.ts',
    'functions/src/messagingRuntimeConfig.ts',
    'functions/src/notificationDeliveryBridge.ts', 'package.json',
    'src/components/common/FileUpload.jsx',
    'src/components/cs/ClientDetails.jsx',
    'src/firebase/attachmentMetadata.js',
    'src/firebase/storageService.js', 'storage.rules',
    'tests/attachment.metadata.test.js',
    'tests/automation.messaging.test.js',
    'tests/functions.automationTrigger.emulator.test.js',
    'tests/messaging.runtime.config.test.js',
    'tests/notification.delivery.bridge.test.js',
    'tests/storage.rules.test.js',
  ],
  files: [{
    path: 'functions/src/messagingRuntimeConfig.ts',
    operations: [
      {
        type: 'replace',
        anchor: '/** Returns the runtime environment required for email delivery. */',
        content: '/**\n * Returns the runtime environment required for email delivery.\n * @return {MessagingEnvironment} Email provider configuration.\n */',
      },
      {
        type: 'replace',
        anchor: '/** Returns the runtime environment required for all messaging providers. */',
        content: '/**\n * Returns the runtime environment required for all messaging providers.\n * @return {MessagingEnvironment} Email and SMS provider configuration.\n */',
      },
    ],
  }],
};
