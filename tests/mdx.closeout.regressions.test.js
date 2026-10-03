import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');
const readSource = (relativePath) =>
  readFileSync(resolve(sourceRoot, relativePath), 'utf8');

describe('MDX closeout cache and reporting contracts', () => {
  it('uses TanStack Query v5 invalidation syntax on core CRM/report pages', () => {
    for (const file of [
      'pages/Leads.jsx',
      'pages/Opportunities.jsx',
      'pages/Tasks.jsx',
      'pages/Reports.jsx',
      'pages/CSManagement.jsx',
    ]) {
      const source = readSource(file);
      expect(source).not.toContain('invalidateQueries([');
    }
  });

  it('refreshes the global activity report cache after lead activity writes', () => {
    const source = readSource('components/crm/ActivityLog.jsx');
    expect(source).toContain(
      "invalidateQueries({ queryKey: ['activities', leadId] })"
    );
    expect(source).toContain(
      "invalidateQueries({ queryKey: ['activities'] })"
    );
  });

  it('keeps MDX fuel fields on the production opportunity form', () => {
    const source = readSource('components/crm/OpportunityForm.jsx');
    for (const field of [
      'primary_fuel_type',
      'estimated_monthly_gallons',
      'pricing_method',
      'delivery_type',
      'deliveries_per_month',
      'tank_rental',
      'number_of_tanks',
      'fuel_margin_per_gallon',
      'current_supplier',
    ]) {
      expect(source).toContain(field);
    }
  });

  it('keeps the richer Phase 13 lead fuel-volume model and compatibility aggregate', () => {
    const source = readSource('components/crm/LeadForm.jsx');
    for (const field of [
      'estimated_unleaded_87_gallons',
      'estimated_unleaded_89_gallons',
      'estimated_unleaded_93_gallons',
      'estimated_clear_diesel_gallons',
      'estimated_dyed_diesel_gallons',
      'estimated_monthly_gallons',
    ]) {
      expect(source).toContain(field);
    }
    expect(source).toContain('lead_temperature');
    expect(source).not.toContain('<SelectItem value="Unrated">Unrated</SelectItem>');
  });

  it('keeps customer creation on persisted Client entities and refreshes the client cache', () => {
    const source = readSource('pages/CSManagement.jsx');
    expect(source).toContain('atlas.entities.Client.create');
    expect(source).toContain(
      "invalidateQueries({ queryKey: ['clients'] })"
    );
    expect(source).toContain('New MDX Customer Account');
  });
});
