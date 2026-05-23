/** @jest-environment jsdom */
import {
  cancellationFeePercent,
  cancellationFeeAmount,
  canCancelWithNoFee,
  cancellationWindowLabel,
  cancellationPolicyDescription,
} from '../../utils/bookingCancellation';

describe('cancellationFeePercent', () => {
  it('returns 0 within cooling-off window', () => {
    expect(cancellationFeePercent('registered', 24)).toBe(0);
    expect(cancellationFeePercent('registered', 48)).toBe(0);
  });
  it('returns 2 for application_received after cooling-off', () => {
    expect(cancellationFeePercent('application_received', 72)).toBe(2);
  });
  it('returns 2 for under_review after cooling-off', () => {
    expect(cancellationFeePercent('under_review', 72)).toBe(2);
  });
  it('returns 5 for approved', () => {
    expect(cancellationFeePercent('approved', 100)).toBe(5);
  });
  it('returns 10 for payment_received', () => {
    expect(cancellationFeePercent('payment_received', 100)).toBe(10);
  });
  it('returns 15 for agreement_signed', () => {
    expect(cancellationFeePercent('agreement_signed', 100)).toBe(15);
  });
  it('returns 20 for registered', () => {
    expect(cancellationFeePercent('registered', 100)).toBe(20);
  });
  it('returns 0 for unknown status', () => {
    expect(cancellationFeePercent('unknown', 100)).toBe(0);
  });
});

describe('cancellationFeeAmount', () => {
  it('returns 0 in cooling-off window', () => {
    expect(cancellationFeeAmount('registered', 1_000_000, 10)).toBe(0);
  });
  it('calculates 5% of booking amount for approved', () => {
    expect(cancellationFeeAmount('approved', 1_000_000, 100)).toBe(50_000);
  });
  it('calculates 10% of booking amount for payment_received', () => {
    expect(cancellationFeeAmount('payment_received', 500_000, 100)).toBe(50_000);
  });
});

describe('canCancelWithNoFee', () => {
  it('returns true within cooling-off', () => {
    expect(canCancelWithNoFee('registered', 0)).toBe(true);
  });
  it('returns false after cooling-off for a paid-stage booking', () => {
    expect(canCancelWithNoFee('payment_received', 72)).toBe(false);
  });
  it('returns true after cooling-off for unknown status', () => {
    expect(canCancelWithNoFee('unknown_status', 100)).toBe(true);
  });
});

describe('cancellationWindowLabel', () => {
  it('shows remaining hours within window', () => {
    const label = cancellationWindowLabel(24);
    expect(label).toMatch(/24h remaining/);
  });
  it('shows exactly 48h remaining at 0 hours', () => {
    expect(cancellationWindowLabel(0)).toMatch(/48h remaining/);
  });
  it('shows expired message after 48h', () => {
    expect(cancellationWindowLabel(49)).toMatch(/expired/i);
  });
});

describe('cancellationPolicyDescription', () => {
  it('returns no-fee message for zero percent', () => {
    expect(cancellationPolicyDescription('approved', 10)).toMatch(/No cancellation fee/i);
  });
  it('includes fee percent in description after cooling-off', () => {
    const desc = cancellationPolicyDescription('approved', 72);
    expect(desc).toMatch(/5%/);
    expect(desc).toMatch(/approved/i);
  });
});
