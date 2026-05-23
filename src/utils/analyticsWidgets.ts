export type TrendDirection = 'up' | 'down' | 'flat';

export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 100 * 10) / 10;
}

export function trendDirection(current: number, previous: number): TrendDirection {
  const delta = current - previous;
  if (Math.abs(delta) < 0.001) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

export function trendClass(direction: TrendDirection, positiveIsGood = true): string {
  if (direction === 'flat') return 'text-gray-500';
  const isPositive = direction === 'up';
  const isGood = positiveIsGood ? isPositive : !isPositive;
  return isGood ? 'text-green-600' : 'text-red-600';
}

export function formatMetricValue(value: number, format: 'count' | 'currency' | 'percent' | 'decimal' = 'count'): string {
  switch (format) {
    case 'currency':
      if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
      if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
      return `₹${value.toLocaleString('en-IN')}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'decimal':
      return value.toFixed(2);
    case 'count':
    default:
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return String(value);
  }
}

export function sparklineData(values: number[]): { min: number; max: number; normalized: number[] } {
  if (values.length === 0) return { min: 0, max: 0, normalized: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const normalized = range === 0
    ? values.map(() => 0.5)
    : values.map((v) => (v - min) / range);
  return { min, max, normalized };
}

export function widgetSummaryLabel(change: number): string {
  if (change === 0) return 'No change';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change}% vs last period`;
}
