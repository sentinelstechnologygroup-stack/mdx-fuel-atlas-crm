export default {
  id: 'phase10-attachment-permissions-corrective',
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
  files: [{
    path: 'src/firebase/attachmentMetadata.js',
    operations: [
      {
        type: 'insertBefore',
        anchor: 'export function attachmentAccessTarget(attachment = {}) {\n',
        content: "function isHttpsUrl(value) {\n  try {\n    return new URL(value).protocol === 'https:';\n  } catch {\n    return false;\n  }\n}\n\n",
      },
      {
        type: 'replace',
        anchor: "    typeof attachment.url === 'string' &&\n    /^https:///i.test(attachment.url.trim())\n",
        content: "    typeof attachment.url === 'string' &&\n    isHttpsUrl(attachment.url.trim())\n",
      },
    ],
  }],
};
