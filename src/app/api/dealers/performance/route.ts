import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { DealersPerformanceResponseSchema } from "@/types/api";

/**
 * GET /api/dealers/performance — proxies to GET /dealers/performance.
 * Optional query params (sortBy, order) forwarded verbatim.
 * Response validated against DealersPerformanceResponseSchema; shape mismatch → 502.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const qs = url.search;

  const upstream = await proxyFetch(req, `/dealers/performance${qs}`);

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

  // Backend may return a bare array — wrap into envelope.
  if (Array.isArray(json)) {
    json = { performance: json };
  }

  const parsed = DealersPerformanceResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
