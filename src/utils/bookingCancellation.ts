const COOLING_OFF_HOURS = 48;

export type BookingStatus =
  | 'application_received'
  | 'under_review'
  | 'approved'
  | 'payment_received'
  | 'agreement_signed'
  | 'registered'
  | 'cancelled';

const STAGE_FEE_PERCENT: Partial<Record<string, number>> = {
  application_received: 2,
  under_review: 2,
  approved: 5,
  payment_received: 10,
  agreement_signed: 15,
  registered: 20,
};

export function cancellationFeePercent(status: string, hoursSinceBooking: number): number {
  if (hoursSinceBooking <= COOLING_OFF_HOURS) return 0;
  return STAGE_FEE_PERCENT[status] ?? 0;
}

export function cancellationFeeAmount(status: string, bookingAmount: number, hoursSinceBooking: number): number {
  const pct = cancellationFeePercent(status, hoursSinceBooking);
  return Math.round(bookingAmount * pct) / 100;
}

export function canCancelWithNoFee(status: string, hoursSinceBooking: number): boolean {
  return cancellationFeePercent(status, hoursSinceBooking) === 0;
}

export function cancellationWindowLabel(hoursSinceBooking: number): string {
  if (hoursSinceBooking <= COOLING_OFF_HOURS) {
    const remaining = Math.ceil(COOLING_OFF_HOURS - hoursSinceBooking);
    return `Free cancellation window: ${remaining}h remaining`;
  }
  return 'Cooling-off period expired';
}

export function cancellationPolicyDescription(status: string, hoursSinceBooking: number): string {
  const pct = cancellationFeePercent(status, hoursSinceBooking);
  if (pct === 0) return 'No cancellation fee applies.';
  return `A ${pct}% cancellation fee will be charged at the ${status.replace(/_/g, ' ')} stage.`;
}
