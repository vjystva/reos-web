import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { UnitPriceConfigSchema } from "@/types/api";
import { isDemoRequest, getDemoPriceConfig } from "@/lib/demo";

/**
 * GET /api/units/[unitId]/price-config — proxies to backend
 * /units/:id/price-config. 404 passes through so the client can fall back
 * to `unit.effectivePrice` when the breakdown endpoint is missing.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { unitId: string } },
): Promise<NextResponse> {
  const { unitId } = ctx.params;
  if (!unitId) {
    return NextResponse.json({ error: "missing_unit_id" }, { status: 400 });
  }
  if (isDemoRequest(req)) {
    const config = getDemoPriceConfig(unitId);
    if (!config) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(config, { status: 200 });
  }

  const upstream = await proxyFetch(
    req,
    `/units/${encodeURIComponent(unitId)}/price-config`,
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (upstream.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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
  const parsed = UnitPriceConfigSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
