export function inventoryTurnoverRate(
  unitsSold: number,
  totalUnits: number,
  months: number,
): number {
  if (totalUnits <= 0 || months <= 0) return 0;
  return Math.round((unitsSold / totalUnits / months) * 1000) / 10;
}

export function conversionRate(bookings: number, inquiries: number): number {
  if (inquiries <= 0) return 0;
  return Math.round((bookings / inquiries) * 10000) / 100;
}

export function averageDealSize(totalRevenue: number, dealsCount: number): number {
  if (dealsCount <= 0) return 0;
  return Math.round(totalRevenue / dealsCount);
}

export function revenueGrowthRate(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatCurrencyCompact(amount: number): string {
  if (!isFinite(amount) || amount < 0) return '₹0';
  if (amount >= 10_000_000) {
    return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
  }
  if (amount >= 100_000) {
    return `₹${(amount / 100_000).toFixed(1)}L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function salesVelocityLabel(
  ratePerMonth: number,
): 'fast' | 'moderate' | 'slow' {
  if (ratePerMonth >= 5) return 'fast';
  if (ratePerMonth >= 2) return 'moderate';
  return 'slow';
}
