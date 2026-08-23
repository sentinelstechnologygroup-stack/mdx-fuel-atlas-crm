import { describe, expect, it } from 'vitest';
import { normalizeAuditLog } from '@/lib/auditLog';

describe('audit log normalization', () => {
  it('normalizes conversion audit records', () => {
    expect(normalizeAuditLog({
      action: 'lead_converted_to_opportunity',
      actor_email: 'salesperson@example.test',
      lead_id: 'lead-1',
      opportunity_id: 'lead-lead-1',
      created_date: '2026-08-22T12:00:00.000Z',
    })).toMatchObject({
      display_timestamp: '2026-08-22T12:00:00.000Z',
      display_user: 'salesperson@example.test',
      display_action: 'Lead Converted To Opportunity',
      display_entity: 'Lead',
      display_entity_id: 'lead-1',
      display_details: 'Server-recorded event',
    });
  });

  it('normalizes ownership audit records and preserves useful details', () => {
    expect(normalizeAuditLog({
      action_type: 'record_reassigned',
      actor_email: 'admin@example.test',
      entity_type: 'opportunity',
      entity_id: 'opportunity-1',
      transfer_type: 'individual',
      transfer_reason: 'Territory coverage change',
      created_date: '2026-08-22T13:00:00.000Z',
    })).toMatchObject({
      display_action: 'Record Reassigned',
      display_entity: 'Opportunity',
      display_entity_id: 'opportunity-1',
      display_details: 'Reason: Territory coverage change · Transfer: Individual',
    });
  });

  it('normalizes system workflow records without inventing an employee', () => {
    expect(normalizeAuditLog({
      action: 'lead_automatically_qualified',
      actor_user_id: 'system',
      lead_id: 'lead-2',
      score: 87,
      created_date: '2026-08-22T14:00:00.000Z',
    })).toMatchObject({
      display_user: 'system',
      display_entity: 'Lead',
      display_entity_id: 'lead-2',
      display_details: 'Score: 87',
    });
  });

  it('converts Firestore timestamp values for display', () => {
    const date = new Date('2026-08-22T15:00:00.000Z');
    const normalized = normalizeAuditLog({
      action: 'permission_model_init',
      timestamp: { toDate: () => date },
    });

    expect(normalized.display_timestamp).toBe(date);
  });
});
