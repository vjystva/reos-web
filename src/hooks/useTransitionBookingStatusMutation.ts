"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  BookingDetail,
  TransitionBookingStatusRequest,
} from "@/types/api";

interface TransitionBookingVars {
  bookingId: string;
  body: TransitionBookingStatusRequest;
}

/**
 * `PATCH /api/bookings/:id/status` -> backend `PATCH /bookings/:id/status`.
 *
 * The upstream transition also drives the linked unit's status in the same
 * transaction (`BOOKING_DRIVES_UNIT`: under_review->approved blocks the unit
 * as `booked`, agreement_signed->registered marks it `registered`, any cancel
 * releases it to `available`), so the units caches are invalidated too.
 */
async function transitionBooking(
  vars: TransitionBookingVars,
): Promise<BookingDetail> {
  const res = await fetch(
    `/api/bookings/${encodeURIComponent(vars.bookingId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vars.body),
    },
  );

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const raw =
      (body as { message?: string | string[] } | null)?.message ??
      (body as { error?: string } | null)?.error ??
      `Transition failed (${res.status}).`;
    throw new Error(Array.isArray(raw) ? raw.join(", ") : String(raw));
  }

  return body as BookingDetail;
}

export function useTransitionBookingStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation<BookingDetail, Error, TransitionBookingVars>({
    mutationFn: transitionBooking,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings", vars.bookingId] });
      void queryClient.invalidateQueries({ queryKey: ["units"] });
    },
  });
}
