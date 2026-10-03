import { describe, expect, it } from 'vitest';
import { filterRecordsByTimeRange, recordReportingDate } from '@/lib/reporting';

const NOW = new Date(2026, 7, 22, 12, 0, 0);
const records = [
  { id: 'today', created_date: new Date(2026, 7, 22, 8, 0, 0) },
  { id: 'this-month', created_date: new Date(2026, 7, 3, 8, 0, 0) },
  { id: 'last-month', created_date: new Date(2026, 6, 15, 8, 0, 0) },
  { id: 'prior-year', created_date: new Date(2025, 11, 31, 8, 0, 0) },
];

describe('reporting time ranges', () => {
  it('supports Firestore timestamps and simulated dates', () => {
    const simulated = new Date(2026, 7, 1);
    expect(recordReportingDate({
      custom_data: { simulated_date: { toDate: () => simulated } },
      created_date: new Date(2020, 0, 1),
    })).toBe(simulated);
  });

  it('filters today, month, previous month, and year boundaries', () => {
    expect(filterRecordsByTimeRange(records, 'today', NOW).map((r) => r.id)).toEqual(['today']);
    expect(filterRecordsByTimeRange(records, 'this_month', NOW).map((r) => r.id)).toEqual(['today', 'this-month']);
    expect(filterRecordsByTimeRange(records, 'last_month', NOW).map((r) => r.id)).toEqual(['last-month']);
    expect(filterRecordsByTimeRange(records, 'this_year', NOW).map((r) => r.id)).toEqual(['today', 'this-month', 'last-month']);
  });
});

