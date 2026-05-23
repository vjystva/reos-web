/** @jest-environment jsdom */
import {
  inventoryTurnoverRate,
  conversionRate,
  averageDealSize,
  revenueGrowthRate,
  formatCurrencyCompact,
  salesVelocityLabel,
} from '../../utils/projectAnalytics';

describe('inventoryTurnoverRate', () => {
  it('calculates turnover rate as percent per month', () => {
    // 20/100 units sold in 4 months → 5% per month
    expect(inventoryTurnoverRate(20, 100, 4)).toBe(5);
  });

  it('returns 0 for zero totalUnits', () => {
    expect(inventoryTurnoverRate(10, 0, 3)).toBe(0);
  });

  it('returns 0 for zero months', () => {
    expect(inventoryTurnoverRate(10, 100, 0)).toBe(0);
  });
});

describe('conversionRate', () => {
  it('calculates booking-to-inquiry conversion', () => {
    expect(conversionRate(10, 100)).toBe(10);
    expect(conversionRate(5, 50)).toBe(10);
  });

  it('returns 0 for zero inquiries', () => {
    expect(conversionRate(5, 0)).toBe(0);
  });

  it('returns 100 when all inquiries convert', () => {
    expect(conversionRate(50, 50)).toBe(100);
  });
});

describe('averageDealSize', () => {
  it('divides total revenue by deal count', () => {
    expect(averageDealSize(100_000_000, 10)).toBe(10_000_000);
  });

  it('returns 0 for zero deals', () => {
    expect(averageDealSize(100_000_000, 0)).toBe(0);
  });
});

describe('revenueGrowthRate', () => {
  it('calculates positive growth', () => {
    expect(revenueGrowthRate(110, 100)).toBe(10);
  });

  it('calculates negative growth', () => {
    expect(revenueGrowthRate(80, 100)).toBe(-20);
  });

  it('returns 0 for zero previous', () => {
    expect(revenueGrowthRate(100, 0)).toBe(0);
  });

  it('returns 0 when unchanged', () => {
    expect(revenueGrowthRate(100, 100)).toBe(0);
  });
});

describe('formatCurrencyCompact', () => {
  it('formats crores correctly', () => {
    expect(formatCurrencyCompact(50_000_000)).toBe('₹5.0Cr');
    expect(formatCurrencyCompact(150_000_000)).toBe('₹15.0Cr');
  });

  it('formats lakhs correctly', () => {
    expect(formatCurrencyCompact(4_500_000)).toBe('₹45.0L');
    expect(formatCurrencyCompact(1_000_000)).toBe('₹10.0L');
  });

  it('formats small amounts with en-IN locale', () => {
    const result = formatCurrencyCompact(50_000);
    expect(result).toContain('₹');
  });

  it('returns ₹0 for invalid input', () => {
    expect(formatCurrencyCompact(Infinity)).toBe('₹0');
    expect(formatCurrencyCompact(-100)).toBe('₹0');
  });
});

describe('salesVelocityLabel', () => {
  it('≥5 units/month is fast', () => {
    expect(salesVelocityLabel(5)).toBe('fast');
    expect(salesVelocityLabel(10)).toBe('fast');
  });

  it('2-5 units/month is moderate', () => {
    expect(salesVelocityLabel(2)).toBe('moderate');
    expect(salesVelocityLabel(4)).toBe('moderate');
  });

  it('<2 units/month is slow', () => {
    expect(salesVelocityLabel(1)).toBe('slow');
    expect(salesVelocityLabel(0)).toBe('slow');
  });
});
