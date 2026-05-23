/** @jest-environment jsdom */
import {
  formatTaxAmount,
  taxRateLabel,
  totalCostLabel,
  stampDutyStateLabel,
  gstCategoryLabel,
} from '../../utils/taxDisplay';

describe('formatTaxAmount', () => {
  it('formats crores', () => {
    expect(formatTaxAmount(50_000_000)).toBe('₹5.00Cr');
  });

  it('formats lakhs', () => {
    expect(formatTaxAmount(500_000)).toBe('₹5.00L');
  });

  it('formats small amounts in en-IN', () => {
    const result = formatTaxAmount(50_000);
    expect(result).toContain('₹');
  });

  it('returns ₹0 for invalid input', () => {
    expect(formatTaxAmount(Infinity)).toBe('₹0');
    expect(formatTaxAmount(-100)).toBe('₹0');
  });
});

describe('taxRateLabel', () => {
  it('appends % and GST', () => {
    expect(taxRateLabel(5)).toBe('5% GST');
    expect(taxRateLabel(1)).toBe('1% GST');
    expect(taxRateLabel(12)).toBe('12% GST');
  });
});

describe('totalCostLabel', () => {
  it('includes "all-in"', () => {
    const result = totalCostLabel(10_000_000, 1_200_000);
    expect(result).toContain('all-in');
    expect(result).toContain('₹');
  });

  it('adds sale price and tax', () => {
    // 10M + 1.2M = 11.2M → ₹1.12Cr
    const result = totalCostLabel(10_000_000, 1_200_000);
    expect(result).toContain('1.12Cr');
  });
});

describe('stampDutyStateLabel', () => {
  it('returns state names', () => {
    expect(stampDutyStateLabel('maharashtra')).toBe('Maharashtra');
    expect(stampDutyStateLabel('karnataka')).toBe('Karnataka');
    expect(stampDutyStateLabel('tamil_nadu')).toBe('Tamil Nadu');
  });

  it('returns raw string for unknown state', () => {
    expect(stampDutyStateLabel('goa')).toBe('goa');
  });
});

describe('gstCategoryLabel', () => {
  it('affordable below 4.5M', () => {
    expect(gstCategoryLabel('residential', 3_000_000)).toBe('Affordable');
  });

  it('standard for 4.5M–10M', () => {
    expect(gstCategoryLabel('residential', 7_000_000)).toBe('Standard');
  });

  it('luxury above 10M', () => {
    expect(gstCategoryLabel('residential', 15_000_000)).toBe('Luxury');
  });

  it('affordable type overrides price', () => {
    expect(gstCategoryLabel('affordable', 8_000_000)).toBe('Affordable');
  });
});
