export default {
  id: 'phase10-attachment-permissions-finalize',
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
    path: 'src/firebase/storageService.js',
    operations: [
      {
        type: 'replace',
        anchor: '    URL.revokeObjectURL(objectUrl);\n',
        content: '    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);\n',
      },
      {
        type: 'replace',
        anchor: '    file_url: attachment.url,\n',
        content: '    file_url: downloadUrl,\n',
      },
    ],
  }],
};
