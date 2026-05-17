import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { SiteVisitsResponseSchema } from "@/types/api";

/**
 * GET /api/site-visits?bookingId=<id>&status=<status>&page=<n>&limit=<n>
 *
 * Proxies to GET /site-visits on the backend.
 * bookingId is required — returns 400 if missing.
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

  const qs = new URLSearchParams(url.searchParams);
  const upstream = await proxyFetch(req, `/site-visits?${qs.toString()}`);

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

  if (Array.isArray(json)) {
    json = { data: json, total: (json as unknown[]).length };
  }

  const parsed = SiteVisitsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
