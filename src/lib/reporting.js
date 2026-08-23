function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function recordReportingDate(record) {
  return toDate(
    record?.custom_data?.simulated_date ||
    record?.created_date ||
    record?.updated_date
  );
}

export function filterRecordsByTimeRange(records, timeRange, now = new Date()) {
  if (!Array.isArray(records) || timeRange === 'all') return records || [];

  const today = startOfDay(now);
  let start = null;
  let end = null;

  if (timeRange === 'today') {
    start = today;
    end = new Date(today);
    end.setDate(end.getDate() + 1);
  } else if (timeRange === 'this_week') {
    start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (timeRange === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (timeRange === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (timeRange === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear() + 1, 0, 1);
  } else {
    return records;
  }

  return records.filter((record) => {
    const date = recordReportingDate(record);
    return date && date >= start && date < end;
  });
}

