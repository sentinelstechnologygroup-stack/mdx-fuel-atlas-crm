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
    const value = Number(opportunity[field]);
    if (Number.isFinite(value) && value >= 0) return value;
  }

  return 0;
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
