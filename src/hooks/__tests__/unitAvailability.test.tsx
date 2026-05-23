/** @jest-environment jsdom */
import {
  unitStatusLabel,
  unitStatusColorClass,
  unitStatusBadgeClass,
  availabilityPercent,
  formatAvailabilityLabel,
  isUnitAvailableForBooking,
} from '../../utils/unitAvailability';

describe('unitStatusLabel', () => {
  it('returns labels for all known statuses', () => {
    expect(unitStatusLabel('available')).toBe('Available');
    expect(unitStatusLabel('on_hold')).toBe('On Hold');
    expect(unitStatusLabel('booked')).toBe('Booked');
    expect(unitStatusLabel('sold')).toBe('Sold');
    expect(unitStatusLabel('blocked')).toBe('Blocked');
  });

  it('returns raw string for unknown status', () => {
    expect(unitStatusLabel('unknown')).toBe('unknown');
    expect(unitStatusLabel('')).toBe('');
  });
});

describe('unitStatusColorClass', () => {
  it('returns correct text color classes', () => {
    expect(unitStatusColorClass('available')).toBe('text-success');
    expect(unitStatusColorClass('on_hold')).toBe('text-warning');
    expect(unitStatusColorClass('booked')).toBe('text-primary');
    expect(unitStatusColorClass('sold')).toBe('text-neutral');
    expect(unitStatusColorClass('blocked')).toBe('text-danger');
  });

  it('returns neutral for unknown', () => {
    expect(unitStatusColorClass('unknown')).toBe('text-neutral');
    expect(unitStatusColorClass('')).toBe('text-neutral');
  });
});

describe('unitStatusBadgeClass', () => {
  it('returns correct badge classes', () => {
    expect(unitStatusBadgeClass('available')).toBe('badge-success');
    expect(unitStatusBadgeClass('blocked')).toBe('badge-danger');
    expect(unitStatusBadgeClass('sold')).toBe('badge-neutral');
  });

  it('returns badge-neutral as default', () => {
    expect(unitStatusBadgeClass('unknown')).toBe('badge-neutral');
  });
});

describe('availabilityPercent', () => {
  it('returns 100 when all units available', () => {
    expect(availabilityPercent(50, 50)).toBe(100);
  });

  it('returns 0 when none available', () => {
    expect(availabilityPercent(0, 50)).toBe(0);
  });

  it('calculates percent correctly', () => {
    expect(availabilityPercent(25, 50)).toBe(50);
    expect(availabilityPercent(10, 40)).toBe(25);
  });

  it('returns 0 for zero total', () => {
    expect(availabilityPercent(0, 0)).toBe(0);
    expect(availabilityPercent(5, 0)).toBe(0);
  });
});

describe('formatAvailabilityLabel', () => {
  it('returns "All N available" when fully available', () => {
    expect(formatAvailabilityLabel(50, 50)).toBe('All 50 available');
  });

  it('returns "Sold out" when none available', () => {
    expect(formatAvailabilityLabel(0, 50)).toBe('Sold out');
  });

  it('returns "N of M available" for partial', () => {
    expect(formatAvailabilityLabel(12, 50)).toBe('12 of 50 available');
  });

  it('returns "0 available" for zero total', () => {
    expect(formatAvailabilityLabel(0, 0)).toBe('0 available');
  });
});

describe('isUnitAvailableForBooking', () => {
  it('returns true only for available', () => {
    expect(isUnitAvailableForBooking('available')).toBe(true);
  });

  it('returns false for all other statuses', () => {
    for (const s of ['on_hold', 'booked', 'sold', 'blocked', 'unknown']) {
      expect(isUnitAvailableForBooking(s)).toBe(false);
    }
  });
});
