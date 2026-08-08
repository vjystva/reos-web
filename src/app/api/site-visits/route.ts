import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { SiteVisitsResponseSchema } from "@/types/api";

/**
 * GET /api/site-visits?bookingId=<id>&status=<status>&page=<n>&limit=<n>
 *
 * Booking-scoped site-visit list for `/dashboard/bookings/:id/site-visits`.
 *
 * WHY THIS IS NOT A STRAIGHT PROXY: `site_visits` rows are LEAD-scoped
 * upstream — the table has no `booking_id` column and `ListSiteVisitsDto`
 * has no `bookingId` (or `limit`) field. This route used to forward
 * `GET /site-visits?bookingId=…&limit=…`, which the backend's
 * `forbidNonWhitelisted` ValidationPipe rejected with
 * 400 "property bookingId should not exist, property limit should not exist",
 * so the per-booking visits page never rendered a single row.
 *
 * The real path is two hops:
 *   1. GET /bookings/:bookingId          -> resolve the booking's leadId
 *   2. GET /leads/:leadId/site-visits    -> the visits for that lead
 *
 * Step 2 returns a bare array (no pagination upstream), so status filtering
 * and paging are applied here. Each row is stamped with `bookingId` so the
 * client cache keys and any downstream mutation calls line up.
 */

const DEFAULT_PAGE_SIZE = 20;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const bookingId = url.searchParams.get("bookingId");

  if (!bookingId) {
    return NextResponse.json(
      { error: "bookingId query param is required" },
      { status: 400 },
    );
  }

  // --- 1. booking -> leadId ------------------------------------------------
  const bookingRes = await proxyFetch(
    req,
    `/bookings/${encodeURIComponent(bookingId)}`,
  );

  if (bookingRes.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!bookingRes.ok) {
    const body = await bookingRes.text().catch(() => "");
    return NextResponse.json(
      { error: "upstream_error", message: body },
      { status: bookingRes.status },
    );
  }

  let booking: unknown;
  try {
    booking = await bookingRes.json();
  } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  const leadId = (booking as { leadId?: unknown })?.leadId;
  if (typeof leadId !== "string" || !leadId) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  // --- 2. lead -> site visits ---------------------------------------------
  const upstream = await proxyFetch(
    req,
    `/leads/${encodeURIComponent(leadId)}/site-visits`,
  );

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

  // Bare array upstream; tolerate an envelope in case that ever changes.
  const rows: unknown[] = Array.isArray(json)
    ? json
    : Array.isArray((json as { data?: unknown })?.data)
      ? ((json as { data: unknown[] }).data)
      : [];

  // Stamp the booking this list was requested for onto each row — the row
  // itself only carries `leadId` upstream.
  let stamped = rows.map((r) =>
    r && typeof r === "object" ? { ...(r as object), bookingId } : r,
  );

  const status = url.searchParams.get("status");
  if (status) {
    stamped = stamped.filter(
      (r) => (r as { status?: string })?.status === status,
    );
  }

  // Newest scheduled first — matches how the list reads on screen.
  stamped.sort((a, b) => {
    const at = new Date((a as { scheduledAt?: string })?.scheduledAt ?? 0).getTime();
    const bt = new Date((b as { scheduledAt?: string })?.scheduledAt ?? 0).getTime();
    return bt - at;
  });

  const total = stamped.length;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(
    1,
    Number(url.searchParams.get("limit") ?? url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) ||
      DEFAULT_PAGE_SIZE,
  );
  const paged = stamped.slice((page - 1) * pageSize, page * pageSize);

  const parsed = SiteVisitsResponseSchema.safeParse({
    data: paged,
    total,
    page,
    pageSize,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * POST /api/site-visits — schedule a new site visit.
 *
 * Body: { leadId, assignedAgentId, scheduledAt, projectId?, notes? }
 * matching backend `CreateSiteVisitDto`. `assignedAgentId` is REQUIRED
 * upstream (`site_visits.assigned_agent_id` is a NOT NULL FK).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const upstream = await proxyFetch(req, "/site-visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rawBody),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try { errBody = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let json: unknown;
  try { json = await upstream.json(); } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(json, { status: 201 });
}
