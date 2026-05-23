/** @jest-environment jsdom */
import {
  holdStatusLabel,
  holdStatusClass,
  holdIsExpired,
  holdMinutesRemaining,
  holdTimeRemainingLabel,
} from '../useHolds';

describe('holdStatusLabel', () => {
  it('returns Active for active', () => {
    expect(holdStatusLabel('active')).toBe('Active');
  });
  it('returns Released for released', () => {
    expect(holdStatusLabel('released')).toBe('Released');
  });
  it('returns Converted for converted', () => {
    expect(holdStatusLabel('converted')).toBe('Converted');
  });
  it('returns Expired for expired', () => {
    expect(holdStatusLabel('expired')).toBe('Expired');
  });
  it('returns raw value for unknown status', () => {
    expect(holdStatusLabel('pending_review')).toBe('pending_review');
  });
});

describe('holdStatusClass', () => {
  it('returns badge-success for active', () => {
    expect(holdStatusClass('active')).toBe('badge-success');
  });
  it('returns badge-neutral for released', () => {
    expect(holdStatusClass('released')).toBe('badge-neutral');
  });
  it('returns badge-primary for converted', () => {
    expect(holdStatusClass('converted')).toBe('badge-primary');
  });
  it('returns badge-warning for expired', () => {
    expect(holdStatusClass('expired')).toBe('badge-warning');
  });
  it('returns badge-neutral for unknown', () => {
    expect(holdStatusClass('unknown_state')).toBe('badge-neutral');
  });
});

describe('holdIsExpired', () => {
  it('returns true for a past timestamp', () => {
    const past = new Date(Date.now() - 10_000).toISOString();
    expect(holdIsExpired(past)).toBe(true);
  });
  it('returns false for a future timestamp', () => {
    const future = new Date(Date.now() + 10_000).toISOString();
    expect(holdIsExpired(future)).toBe(false);
  });
});

describe('holdMinutesRemaining', () => {
  it('returns 0 for an expired hold', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(holdMinutesRemaining(past)).toBe(0);
  });
  it('returns approximate minutes for a future hold', () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    expect(holdMinutesRemaining(future)).toBeGreaterThanOrEqual(9);
    expect(holdMinutesRemaining(future)).toBeLessThanOrEqual(10);
  });
});

describe('holdTimeRemainingLabel', () => {
  it('returns Expired for past timestamps', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(holdTimeRemainingLabel(past)).toBe('Expired');
  });
  it('returns minutes remaining for < 1 hour', () => {
    const future = new Date(Date.now() + 30 * 60_000).toISOString();
    expect(holdTimeRemainingLabel(future)).toMatch(/\d+m remaining/);
  });
  it('returns hours remaining for >= 1 hour', () => {
    const future = new Date(Date.now() + 120 * 60_000).toISOString();
    expect(holdTimeRemainingLabel(future)).toMatch(/2h remaining/);
  });
  it('returns hours and minutes for non-round hours', () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString();
    expect(holdTimeRemainingLabel(future)).toMatch(/1h 3[0-9]m remaining/);
  });
});
