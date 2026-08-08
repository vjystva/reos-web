import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { PaymentSchedulesResponseSchema } from "@/types/api";
import { isDemoRequest, getDemoPaymentSchedule } from "@/lib/demo";

/**
 * GET /api/payment-schedules?bookingId=<id>
 *
 * Proxies to GET /payment-schedules?bookingId= on the backend.
 * Returns 400 if bookingId query param is missing.
 * Returns 502 on upstream shape mismatch.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const bookingId = url.searchParams.get("bookingId");

  if (!bookingId) {
    return NextResponse.json(
      { error: "bookingId query param is required" },
      { status: 400 },
    );
  }

  if (isDemoRequest(req)) {
    return NextResponse.json(getDemoPaymentSchedule(bookingId), { status: 200 });
  }

  const upstream = await proxyFetch(req, `/bookings/${encodeURIComponent(bookingId)}/payment-schedule`);

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    const body = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "upstream_error", message: body },
      { status: upstream.status },
    );
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  // `GET /bookings/:id/payment-schedule` returns ONE PaymentScheduleResponseDto
  // object — a booking has at most one schedule. The UI consumes a paginated
  // envelope (`scheduleQuery.data.data[0]`), so wrap it. Without this the
  // envelope parse failed and the card rendered "Could not load payment
  // schedule" on every booking that actually had one.
  if (Array.isArray(json)) {
    json = { data: json, total: (json as unknown[]).length };
  } else if (json && typeof json === "object" && !("data" in json)) {
    json = { data: [json], total: 1, page: 1, pageSize: 1 };
  }

  const parsed = PaymentSchedulesResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
