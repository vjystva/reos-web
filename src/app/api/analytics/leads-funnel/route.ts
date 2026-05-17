import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { LeadsFunnelResponseSchema } from "@/types/api";

/**
 * GET /api/analytics/leads-funnel — proxies to backend /analytics/leads-funnel.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/analytics/leads-funnel");

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
