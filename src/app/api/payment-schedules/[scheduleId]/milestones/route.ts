import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { MilestonesResponseSchema } from "@/types/api";
import { isDemoRequest, getDemoMilestones } from "@/lib/demo";

/**
 * GET /api/payment-schedules/[scheduleId]/milestones?bookingId=<id>
 *
 * Proxies to `GET /bookings/:bookingId/payment-schedule/milestones`
 * (`PaymentMilestonesController.list`).
 *
 * There is NO `/payment-schedules/:id/milestones` endpoint upstream — that
 * URL 404s. Every payment-schedule route is nested under its booking, and a
 * booking has exactly one schedule, so the booking id is the addressable key.
 * `scheduleId` stays in the path because it is what the milestone react-query
 * cache is keyed on; `bookingId` is what actually builds the upstream URL.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> },
): Promise<NextResponse> {
  const { scheduleId } = await params;
  const bookingId = new URL(req.url).searchParams.get("bookingId");

  if (isDemoRequest(req)) {
    return NextResponse.json(getDemoMilestones(scheduleId), { status: 200 });
  }

  if (!bookingId) {
    return NextResponse.json(
      { error: "bookingId query param is required" },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(
    req,
    `/bookings/${encodeURIComponent(bookingId)}/payment-schedule/milestones`,
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (upstream.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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

  // Normalise array to paginated envelope.
  if (Array.isArray(json)) {
    json = { data: json, total: (json as unknown[]).length };
  }

  const parsed = MilestonesResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
