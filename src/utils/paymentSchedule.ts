import type { Milestone, PaymentSchedule } from '@/types/api';

export function milestoneProgressPercent(amountPaid: number, dueAmount: number): number {
  if (dueAmount <= 0) return 100;
  return Math.min(100, Math.round((amountPaid / dueAmount) * 100));
}

export function milestoneStatusClass(status?: string): string {
  const map: Record<string, string> = {
    paid: 'badge-success',
    pending: 'badge-neutral',
    overdue: 'badge-danger',
    partial: 'badge-warning',
  };
  return map[status ?? ''] ?? 'badge-neutral';
}

export function milestoneStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    paid: 'Paid',
    pending: 'Pending',
    overdue: 'Overdue',
    partial: 'Partial',
  };
  return map[status ?? ''] ?? (status ?? 'Pending');
}

export function formatDueDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function scheduleOutstandingAmount(
  schedule: Pick<PaymentSchedule, 'totalAmount' | 'amountPaid'>,
): number {
  return Math.max(0, schedule.totalAmount - schedule.amountPaid);
}

export function scheduleCompletionPercent(
  schedule: Pick<PaymentSchedule, 'totalAmount' | 'amountPaid'>,
): number {
  if (schedule.totalAmount <= 0) return 100;
  return Math.min(100, Math.round((schedule.amountPaid / schedule.totalAmount) * 100));
}

export function sortMilestonesByDueDate(milestones: Milestone[]): Milestone[] {
  return [...milestones].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
}

export function countOverdueMilestones(milestones: Milestone[]): number {
  return milestones.filter((m) => m.status === 'overdue' || m.overdue === true).length;
}
