export default {
  id: 'phase10-production-config-jsdoc',
  description: 'Document the production messaging runtime configuration helpers.',
  allowedBranches: ['migration/phase-10-final-workflow-integrations-release-readiness'],
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore',
    'functions/src/automation.ts',
    'functions/src/index.ts',
    'functions/src/messagingRuntimeConfig.ts',
    'functions/src/notificationDeliveryBridge.ts',
    'package.json',
    'src/components/common/FileUpload.jsx',
    'src/components/cs/ClientDetails.jsx',
    'src/firebase/attachmentMetadata.js',
    'src/firebase/storageService.js',
    'storage.rules',
    'tests/attachment.metadata.test.js',
    'tests/automation.messaging.test.js',
    'tests/functions.automationTrigger.emulator.test.js',
    'tests/messaging.runtime.config.test.js',
    'tests/notification.delivery.bridge.test.js',
    'tests/storage.rules.test.js',
    'tools/patch-engine',
  ],
  files: [
    {
      path: 'functions/src/messagingRuntimeConfig.ts',
      operations: [
        {
          type: 'insertBefore',
          anchor: 'export function emailMessagingEnvironment(): MessagingEnvironment {\n',
          content: '/** Returns the runtime environment required for email delivery. */\n',
        },
        {
          type: 'insertBefore',
          anchor: 'export function messagingEnvironment(): MessagingEnvironment {\n',
          content: '/** Returns the runtime environment required for all messaging providers. */\n',
        },
      ],
    },
  ],
};
