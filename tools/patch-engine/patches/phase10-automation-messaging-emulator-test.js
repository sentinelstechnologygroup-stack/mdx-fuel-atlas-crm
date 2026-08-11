export default {
  id: 'phase10-automation-messaging-emulator-test',
  expectedHead: 'b3845bd135b8e036af42771eea448a6abcde036b',
  preExistingChanges: [
    '.gitignore', 'functions/src/automation.ts', 'functions/src/index.ts',
    'functions/src/notificationDeliveryBridge.ts', 'package.json',
    'tests/automation.messaging.test.js',
    'tests/notification.delivery.bridge.test.js',
  ],
  files: [{
    path: 'tests/functions.automationTrigger.emulator.test.js',
    operations: [{
      type: 'insertBefore',
      anchor: '    it(\n      \'fails closed for unrestricted entity updates\',\n',
      content: `    it(
      'routes email actions through safe-disabled delivery',
      async () => {
        await writeFixture(
          'AutomationRule',
          'server-email-delivery',
          {
            name: 'Server email delivery',
            trigger_entity: 'Lead',
            trigger_event: 'create',
            action_type: 'send_email',
            action_config: {
              email_to: '{{email}}',
              email_subject: 'Welcome {{full_name}}',
              email_body: 'Your CRM record is ready.',
            },
            is_active: true,
          }
        );

        await writeFixture(
          'Lead',
          'automation-email-lead',
          {
            full_name: 'Email Lead',
            email: 'lead@example.test',
            lead_status: 'New',
          }
        );

        const logs = await waitForLogs();

        expect(logs.size).toBe(1);
        expect(logs.docs[0].data()).toMatchObject({
          rule_id: 'server-email-delivery',
          entity_type: 'Lead',
          entity_id: 'automation-email-lead',
          status: 'skipped',
          error_message: 'provider_not_configured',
          action_taken:
            'send_email: server-controlled delivery',
        });
        expect(
          logs.docs[0].data().action_taken
        ).not.toContain('lead@example.test');
        expect((await listFixtures('Task')).size)
          .toBe(0);
      }
    );

`,
    }],
  }],
};
