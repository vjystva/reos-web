const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  on_hold: 'On Hold',
  booked: 'Booked',
  sold: 'Sold',
  blocked: 'Blocked',
};

const STATUS_COLOR_CLASSES: Record<string, string> = {
  available: 'text-success',
  on_hold: 'text-warning',
  booked: 'text-primary',
  sold: 'text-neutral',
  blocked: 'text-danger',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  available: 'badge-success',
  on_hold: 'badge-warning',
  booked: 'badge-primary',
  sold: 'badge-neutral',
  blocked: 'badge-danger',
};

export function unitStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function unitStatusColorClass(status: string): string {
  return STATUS_COLOR_CLASSES[status] ?? 'text-neutral';
}

export function unitStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? 'badge-neutral';
}

export function availabilityPercent(available: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((available / total) * 100);
}

export function formatAvailabilityLabel(available: number, total: number): string {
  if (total <= 0) return '0 available';
  if (available === total) return `All ${total} available`;
  if (available === 0) return `Sold out`;
  return `${available} of ${total} available`;
}

export function isUnitAvailableForBooking(status: string): boolean {
  return status === 'available';
}
