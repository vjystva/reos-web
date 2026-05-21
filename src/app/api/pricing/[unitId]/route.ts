import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { PricePredictionResponseSchema } from "@/types/api";

/**
 * GET /api/pricing/[unitId] — BFF proxy to the AI service pricing endpoint.
 * Validates the upstream response shape before forwarding to the client.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { unitId: string } },
): Promise<NextResponse> {
  const { unitId } = ctx.params;
  if (!unitId) {
    return NextResponse.json({ error: "missing_unit_id" }, { status: 400 });
  }

  const upstream = await proxyFetch(
    req,
    `/pricing/${encodeURIComponent(unitId)}`,
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

  const parsed = PricePredictionResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
