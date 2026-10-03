const GALLON_FIELDS = [
  'estimated_monthly_gallons',
  'monthly_gallons',
  'gallons_per_month',
  'estimated_gallons',
  'gallons_sold',
];

export function getOpportunityGallons(opportunity) {
  if (!opportunity || typeof opportunity !== 'object') return 0;

  for (const field of GALLON_FIELDS) {
    const rawValue = opportunity[field];
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    const value = Number(rawValue);
    if (Number.isFinite(value) && value >= 0) return value;
  }

  return 0;
}

export function getOpportunityOwnerKey(opportunity) {
  return opportunity?.owner_user_id ||
    opportunity?.created_by_user_id ||
    opportunity?.assigned_to ||
    opportunity?.created_by ||
    'Unassigned';
}

function normalizedStage(opportunity) {
  return String(opportunity?.deal_stage || '').trim().toLowerCase();
}

export function isWonOpportunity(opportunity) {
  return normalizedStage(opportunity).includes('won');
}

export function isLostOpportunity(opportunity) {
  return normalizedStage(opportunity).includes('lost');
}

export function isOpenOpportunity(opportunity) {
  return !isWonOpportunity(opportunity) && !isLostOpportunity(opportunity);
}

export function getMonthlyGallonQuota(profile) {
  const value = Number(
    profile?.monthly_gallon_quota ??
    profile?.gallon_quota ??
    profile?.sales_goal_gallons
  );

  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function getPeriodGallonQuota(monthlyQuota, timeRange) {
  if (!monthlyQuota) return 0;

  const multiplier = {
    today: 12 / 365,
    week: 12 / 52,
    month: 1,
    quarter: 3,
    year: 12,
    all: 0,
  }[timeRange] ?? 1;

  return Math.round(monthlyQuota * multiplier);
}

export function formatGallons(value, options = {}) {
  const gallons = Number(value) || 0;
  const { compact = false } = options;

  if (compact) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(gallons);
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(gallons);
}
