import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { LeadsFunnelResponseSchema } from "@/types/api";

/**
 * GET /api/analytics/leads-funnel — proxies to backend /analytics/leads-funnel.
 *
 * Forwards optional ?from=&to= cohort params. When neither is supplied the
 * backend returns the funnel for ALL leads (current-state view) — that is what
 * the dashboard "Open pipeline" tile wants.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  if (searchParams.get("from")) qs.set("from", searchParams.get("from")!);
  if (searchParams.get("to")) qs.set("to", searchParams.get("to")!);

  const path = qs.toString()
    ? `/analytics/leads-funnel?${qs.toString()}`
    : "/analytics/leads-funnel";

  const upstream = await proxyFetch(req, path);

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  const parsed = LeadsFunnelResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
