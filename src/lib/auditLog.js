function firstValue(record, fields) {
  for (const field of fields) {
    const value = record?.[field];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function inferEntity(record) {
  if (record?.lead_id) return 'Lead';
  if (record?.opportunity_id) return 'Opportunity';
  if (record?.client_id) return 'Client';
  if (record?.target_user_id) return 'User';
  if (record?.module_key || record?.override_id) return 'Permission';
  return 'System';
}

function humanize(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  return value;
}

function summarize(record) {
  if (record?.details) return String(record.details);

  const parts = [];
  const reason = firstValue(record, ['reason', 'transfer_reason']);
  if (reason) parts.push(`Reason: ${reason}`);
  if (record?.module_key) parts.push(`Module: ${humanize(record.module_key)}`);
  if (Number.isFinite(Number(record?.score))) parts.push(`Score: ${Number(record.score)}`);
  if (record?.transfer_type) parts.push(`Transfer: ${humanize(record.transfer_type)}`);
  if (record?.task_id) parts.push(`Task: ${record.task_id}`);

  return parts.join(' · ') || 'Server-recorded event';
}

export function normalizeAuditLog(record) {
  const entity = firstValue(record, [
    'entity',
    'entity_type',
    'entity_collection',
  ]) || inferEntity(record);

  return {
    ...record,
    display_timestamp: normalizeTimestamp(
      firstValue(record, [
        'timestamp',
        'created_date',
        'updated_date',
      ])
    ),
    display_user: firstValue(record, [
      'user_email',
      'actor_email',
      'target_email',
      'actor_user_id',
    ]) || 'system',
    display_action: humanize(
      firstValue(record, ['action', 'action_type']) || 'system_event'
    ),
    display_entity: humanize(entity),
    display_entity_id: firstValue(record, [
      'entity_id',
      'lead_id',
      'opportunity_id',
      'client_id',
      'target_user_id',
      'override_id',
    ]),
    display_details: summarize(record),
  };
}
