import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { LeadsBySourceResponseSchema } from "@/types/api";

/**
 * GET /api/analytics/leads-by-source — proxies to backend
 * /analytics/leads-by-source. Forwards optional ?from=&to= date range params.
 * Returns { data: [] } on upstream 404 so the UI renders an empty state.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  if (searchParams.has("from")) qs.set("from", searchParams.get("from")!);
  if (searchParams.has("to")) qs.set("to", searchParams.get("to")!);

  const path = qs.toString()
    ? `/analytics/leads-by-source?${qs.toString()}`
    : "/analytics/leads-by-source";

  const upstream = await proxyFetch(req, path);

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (upstream.status === 404) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_error" },
      { status: upstream.status },
    );
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  const parsed = LeadsBySourceResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
