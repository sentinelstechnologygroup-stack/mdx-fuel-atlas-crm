import { describe, expect, it } from 'vitest';
import {
  getOpportunityGallons,
  getOpportunityOwnerKey,
  isLostOpportunity,
  isOpenOpportunity,
  isWonOpportunity,
} from '@/lib/fuelVolume';

describe('opportunity reporting compatibility', () => {
  it('prefers the canonical gallon field and supports legacy fallbacks', () => {
    expect(getOpportunityGallons({ estimated_monthly_gallons: 25000, monthly_gallons: 10 })).toBe(25000);
    expect(getOpportunityGallons({ monthly_gallons: 12000 })).toBe(12000);
    expect(getOpportunityGallons({ estimated_monthly_gallons: null, gallons_per_month: 8000 })).toBe(8000);
  });

  it('uses Firebase ownership before legacy salesperson fields', () => {
    expect(getOpportunityOwnerKey({
      owner_user_id: 'owner-1',
      assigned_to: 'legacy@example.test',
    })).toBe('owner-1');
    expect(getOpportunityOwnerKey({ assigned_to: 'legacy@example.test' })).toBe('legacy@example.test');
  });

  it('classifies canonical and compatible closed stages', () => {
    expect(isWonOpportunity({ deal_stage: 'Closed Won' })).toBe(true);
    expect(isLostOpportunity({ deal_stage: 'Closed Lost' })).toBe(true);
    expect(isOpenOpportunity({ deal_stage: 'Prospect' })).toBe(true);
    expect(isOpenOpportunity({ deal_stage: null })).toBe(true);
  });
});
