/** @jest-environment jsdom */
import {
  milestoneProgressPercent,
  milestoneStatusClass,
  milestoneStatusLabel,
  formatDueDate,
  scheduleOutstandingAmount,
  scheduleCompletionPercent,
  sortMilestonesByDueDate,
  countOverdueMilestones,
} from '../../utils/paymentSchedule';
import type { Milestone } from '../../types/api';

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: 'm1',
    name: 'Test Milestone',
    dueDate: '2025-06-01',
    dueAmount: 100000,
    amountPaid: 0,
    status: 'pending',
    ...overrides,
  } as Milestone;
}

describe('milestoneProgressPercent', () => {
  it('returns 0 when nothing paid', () => {
    expect(milestoneProgressPercent(0, 100000)).toBe(0);
  });
  it('returns 50 when half paid', () => {
    expect(milestoneProgressPercent(50000, 100000)).toBe(50);
  });
  it('returns 100 when fully paid', () => {
    expect(milestoneProgressPercent(100000, 100000)).toBe(100);
  });
  it('caps at 100 even if overpaid', () => {
    expect(milestoneProgressPercent(120000, 100000)).toBe(100);
  });
  it('returns 100 when dueAmount is 0', () => {
    expect(milestoneProgressPercent(0, 0)).toBe(100);
  });
});

describe('milestoneStatusClass', () => {
  it('returns badge-success for paid', () => {
    expect(milestoneStatusClass('paid')).toBe('badge-success');
  });
  it('returns badge-neutral for pending', () => {
    expect(milestoneStatusClass('pending')).toBe('badge-neutral');
  });
  it('returns badge-danger for overdue', () => {
    expect(milestoneStatusClass('overdue')).toBe('badge-danger');
  });
  it('returns badge-warning for partial', () => {
    expect(milestoneStatusClass('partial')).toBe('badge-warning');
  });
  it('returns badge-neutral for undefined', () => {
    expect(milestoneStatusClass(undefined)).toBe('badge-neutral');
  });
  it('returns badge-neutral for unknown status', () => {
    expect(milestoneStatusClass('cancelled')).toBe('badge-neutral');
  });
});

describe('milestoneStatusLabel', () => {
  it('returns Paid for paid', () => expect(milestoneStatusLabel('paid')).toBe('Paid'));
  it('returns Pending for pending', () => expect(milestoneStatusLabel('pending')).toBe('Pending'));
  it('returns Overdue for overdue', () => expect(milestoneStatusLabel('overdue')).toBe('Overdue'));
  it('returns Partial for partial', () => expect(milestoneStatusLabel('partial')).toBe('Partial'));
  it('returns raw value for unknown', () => expect(milestoneStatusLabel('custom')).toBe('custom'));
});

describe('formatDueDate', () => {
  it('formats a valid ISO date', () => {
    const result = formatDueDate('2025-06-15');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });
  it('returns original string for invalid date', () => {
    expect(formatDueDate('not-a-date')).toBe('not-a-date');
  });
});

describe('scheduleOutstandingAmount', () => {
  it('returns difference when partially paid', () => {
    expect(scheduleOutstandingAmount({ totalAmount: 1000000, amountPaid: 200000 })).toBe(800000);
  });
  it('returns 0 when fully paid', () => {
    expect(scheduleOutstandingAmount({ totalAmount: 500000, amountPaid: 500000 })).toBe(0);
  });
  it('returns 0 when overpaid (no negative outstanding)', () => {
    expect(scheduleOutstandingAmount({ totalAmount: 500000, amountPaid: 600000 })).toBe(0);
  });
});

describe('scheduleCompletionPercent', () => {
  it('returns 0 when nothing paid', () => {
    expect(scheduleCompletionPercent({ totalAmount: 100, amountPaid: 0 })).toBe(0);
  });
  it('returns 75 when 75% paid', () => {
    expect(scheduleCompletionPercent({ totalAmount: 100, amountPaid: 75 })).toBe(75);
  });
  it('returns 100 when fully paid', () => {
    expect(scheduleCompletionPercent({ totalAmount: 100, amountPaid: 100 })).toBe(100);
  });
  it('returns 100 when totalAmount is 0', () => {
    expect(scheduleCompletionPercent({ totalAmount: 0, amountPaid: 0 })).toBe(100);
  });
});

describe('sortMilestonesByDueDate', () => {
  it('sorts by dueDate ascending', () => {
    const milestones = [
      makeMilestone({ id: 'm3', dueDate: '2025-09-01' }),
      makeMilestone({ id: 'm1', dueDate: '2025-01-01' }),
      makeMilestone({ id: 'm2', dueDate: '2025-06-01' }),
    ];
    const sorted = sortMilestonesByDueDate(milestones);
    expect(sorted.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });
  it('does not mutate the original array', () => {
    const original = [makeMilestone({ dueDate: '2025-09-01' }), makeMilestone({ dueDate: '2025-01-01' })];
    sortMilestonesByDueDate(original);
    expect(original[0].dueDate).toBe('2025-09-01');
  });
});

describe('countOverdueMilestones', () => {
  it('counts milestones with status overdue', () => {
    const ms = [
      makeMilestone({ status: 'overdue' }),
      makeMilestone({ status: 'paid' }),
      makeMilestone({ status: 'overdue' }),
    ];
    expect(countOverdueMilestones(ms)).toBe(2);
  });
  it('counts milestones with overdue=true flag', () => {
    const ms = [makeMilestone({ overdue: true }), makeMilestone({ overdue: false })];
    expect(countOverdueMilestones(ms)).toBe(1);
  });
  it('returns 0 when none are overdue', () => {
    expect(countOverdueMilestones([makeMilestone({ status: 'pending' })])).toBe(0);
  });
});
