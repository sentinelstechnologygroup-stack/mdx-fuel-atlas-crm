import {describe, expect, it} from "vitest";
import {buildAutomationEmailRequest} from "../functions/src/automation.ts";

const rule = {
  id: "welcome-email",
  name: "Welcome email",
  trigger_entity: "Lead",
  trigger_event: "create",
  condition_field: null,
  condition_operator: "equals",
  condition_value: null,
  action_type: "send_email",
  action_config: {
    email_to: "{{email}}",
    email_subject: "Welcome, {{full_name}}",
    email_body: "Call us at {{phone_number}}.",
  },
};

describe("Phase 10 automation messaging", () => {
  it("builds a deterministic server-owned request", () => {
    const first = buildAutomationEmailRequest(
      rule, "Lead", "lead-1", "event-1",
      {
        email: "lead@example.test",
        full_name: "Fleet Manager",
        phone_number: "281-555-0101",
      },
    );
    const second = buildAutomationEmailRequest(
      rule, "Lead", "lead-1", "event-1",
      {
        email: "lead@example.test",
        full_name: "Fleet Manager",
        phone_number: "281-555-0101",
      },
    );

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      recipient: "lead@example.test",
      subject: "Welcome, Fleet Manager",
      message: "Call us at 281-555-0101.",
      sourceType: "Automation",
      sourceId: "Lead/lead-1",
    });
    expect(first.idempotencyKey)
      .toMatch(/^automation:[a-f0-9]{64}:email$/);
  });

  it.each([
    [{email_to: "invalid", email_subject: "Subject", email_body: "Body"}, /recipient/],
    [{email_to: "{{email}}", email_subject: "", email_body: "Body"}, /subject/],
    [{email_to: "{{email}}", email_subject: "Subject", email_body: ""}, /body/],
  ])("rejects unsafe or incomplete configuration", (action_config, error) => {
    expect(() => buildAutomationEmailRequest(
      {...rule, action_config},
      "Lead", "lead-2", "event-2",
      {email: "lead@example.test"},
    )).toThrow(error);
  });
});
