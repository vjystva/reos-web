/** @jest-environment jsdom */
import {
  percentageChange,
  trendDirection,
  trendClass,
  formatMetricValue,
  sparklineData,
  widgetSummaryLabel,
} from '../../utils/analyticsWidgets';

describe('percentageChange', () => {
  it('calculates positive change', () => expect(percentageChange(120, 100)).toBe(20));
  it('calculates negative change', () => expect(percentageChange(80, 100)).toBe(-20));
  it('returns 0 for no change', () => expect(percentageChange(100, 100)).toBe(0));
  it('returns 100 when previous is 0 and current > 0', () => expect(percentageChange(50, 0)).toBe(100));
  it('returns 0 when both are 0', () => expect(percentageChange(0, 0)).toBe(0));
  it('rounds to one decimal', () => expect(percentageChange(110, 99)).toBeCloseTo(11.1, 1));
});

describe('trendDirection', () => {
  it('returns up when current > previous', () => expect(trendDirection(110, 100)).toBe('up'));
  it('returns down when current < previous', () => expect(trendDirection(90, 100)).toBe('down'));
  it('returns flat when equal', () => expect(trendDirection(100, 100)).toBe('flat'));
});

describe('trendClass', () => {
  it('returns green for up when positiveIsGood', () => expect(trendClass('up')).toBe('text-green-600'));
  it('returns red for down when positiveIsGood', () => expect(trendClass('down')).toBe('text-red-600'));
  it('returns gray for flat', () => expect(trendClass('flat')).toBe('text-gray-500'));
  it('inverts for negativeIsGood (e.g. churn rate)', () => {
    expect(trendClass('up', false)).toBe('text-red-600');
    expect(trendClass('down', false)).toBe('text-green-600');
  });
});

describe('formatMetricValue', () => {
  it('formats count with K suffix', () => expect(formatMetricValue(5000)).toBe('5.0K'));
  it('formats count with M suffix', () => expect(formatMetricValue(2_000_000)).toBe('2.0M'));
  it('formats small count as integer', () => expect(formatMetricValue(42)).toBe('42'));
  it('formats currency in lakhs', () => expect(formatMetricValue(500_000, 'currency')).toBe('₹5.0L'));
  it('formats currency in crores', () => expect(formatMetricValue(10_000_000, 'currency')).toBe('₹1.0Cr'));
  it('formats percentage with one decimal', () => expect(formatMetricValue(72.5, 'percent')).toBe('72.5%'));
  it('formats decimal to 2 places', () => expect(formatMetricValue(3.14159, 'decimal')).toBe('3.14'));
});

describe('sparklineData', () => {
  it('returns empty for empty input', () => {
    const result = sparklineData([]);
    expect(result.normalized).toHaveLength(0);
  });
  it('normalizes to 0–1 range', () => {
    const { normalized } = sparklineData([0, 50, 100]);
    expect(normalized[0]).toBe(0);
    expect(normalized[2]).toBe(1);
    expect(normalized[1]).toBe(0.5);
  });
  it('returns 0.5 for flat series', () => {
    const { normalized } = sparklineData([5, 5, 5]);
    expect(normalized.every((v) => v === 0.5)).toBe(true);
  });
  it('returns correct min and max', () => {
    const { min, max } = sparklineData([10, 30, 20]);
    expect(min).toBe(10);
    expect(max).toBe(30);
  });
});

describe('widgetSummaryLabel', () => {
  it('shows no change for 0', () => expect(widgetSummaryLabel(0)).toBe('No change'));
  it('shows positive change with + sign', () => expect(widgetSummaryLabel(15)).toBe('+15% vs last period'));
  it('shows negative change without + sign', () => expect(widgetSummaryLabel(-8)).toBe('-8% vs last period'));
});
