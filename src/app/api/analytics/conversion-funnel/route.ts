import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { ConversionFunnelSchema } from "@/types/api";

/**
 * GET /api/analytics/conversion-funnel — proxies to backend
 * /analytics/conversion-funnel.
 * Returns { stages: [] } on upstream 404.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/analytics/conversion-funnel");

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (upstream.status === 404) {
    return NextResponse.json({ stages: [] }, { status: 200 });
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

  const parsed = ConversionFunnelSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
