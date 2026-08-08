import type { BookingLifecycleStatus } from "@/types/api";

/**
 * Client-side mirror of `ALLOWED_BOOKING_TRANSITIONS` in
 * `reos-backend/src/bookings/booking.constants.ts`.
 *
 * The backend is the authority — it re-validates every transition and answers
 * 422 for an illegal one. This map exists purely so the UI only ever offers
 * moves that will actually succeed, instead of rendering a dropdown of seven
 * statuses where six of them 422.
 *
 * Keep in sync with the backend constant. Empty array = terminal status.
 */
export const ALLOWED_BOOKING_TRANSITIONS: Record<
  BookingLifecycleStatus,
  BookingLifecycleStatus[]
> = {
  application_received: ["under_review", "cancelled"],
  under_review: ["approved", "cancelled"],
  approved: ["payment_received", "cancelled"],
  payment_received: ["agreement_signed", "cancelled"],
  agreement_signed: ["registered", "cancelled"],
  registered: ["cancelled"], // builder_admin only, enforced server-side
  cancelled: [],
};

/**
 * Next statuses reachable from `status`. Unknown/absent status yields an
 * empty list rather than throwing — the bookings list renders rows from a
 * `.passthrough()` schema and cannot assume the value is in the enum.
 */
export function allowedBookingTransitions(
  status: string | null | undefined,
): BookingLifecycleStatus[] {
  if (!status) return [];
  return (
    ALLOWED_BOOKING_TRANSITIONS[status as BookingLifecycleStatus] ?? []
  );
}

/** `cancelReason` is mandatory upstream for this one target. */
export function requiresCancelReason(
  toStatus: BookingLifecycleStatus,
): boolean {
  return toStatus === "cancelled";
}
