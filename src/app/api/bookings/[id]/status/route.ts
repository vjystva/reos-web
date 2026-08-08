import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import {
  BookingDetailSchema,
  TransitionBookingStatusRequestSchema,
} from "@/types/api";

/**
 * PATCH /api/bookings/[id]/status
 * Body: { toStatus, note?, cancelReason? }
 *
 * Proxies to `PATCH /bookings/:id/status` (`BookingsController.transitionStatus`,
 * `TransitionBookingStatusDto`). The backend re-validates the move against
 * `ALLOWED_BOOKING_TRANSITIONS`, gates it on role via
 * `BOOKING_TRANSITION_ROLES`, and drives the linked unit's status in the same
 * transaction (`BOOKING_DRIVES_UNIT`).
 *
 * The endpoint has always existed upstream but nothing in the web app called
 * it — there was no way to move a booking through
 * application_received -> … -> registered from the UI at all.
 *
 * Non-2xx (422 illegal transition, 403 wrong role, 409 unit not in the
 * expected state) is passed through with the body intact so the UI can show
 * the real reason.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = TransitionBookingStatusRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Omit optional keys entirely rather than sending undefined/null — the
  // backend runs a whitelisting validator and `@MinLength(1)` on both.
  const upstreamBody: Record<string, string> = {
    toStatus: parsed.data.toStatus,
  };
  if (parsed.data.note) upstreamBody.note = parsed.data.note;
  if (parsed.data.cancelReason) {
    upstreamBody.cancelReason = parsed.data.cancelReason;
  }

  const upstream = await proxyFetch(
    req,
    `/bookings/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upstreamBody),
    },
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    json = {};
  }

  if (!upstream.ok) {
    return NextResponse.json(json, { status: upstream.status });
  }

  const parsedBooking = BookingDetailSchema.safeParse(json);
  if (!parsedBooking.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsedBooking.data, { status: 200 });
}
