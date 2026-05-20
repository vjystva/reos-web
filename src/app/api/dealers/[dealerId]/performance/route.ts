import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { DealerPerformanceResponseSchema } from "@/types/api";

/**
 * GET /api/dealers/[dealerId]/performance — proxies to GET /dealers/:id/performance.
 * Response validated against DealerPerformanceResponseSchema; shape mismatch → 502.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dealerId: string }> },
): Promise<NextResponse> {
  const { dealerId } = await params;

  const upstream = await proxyFetch(
    req,
    `/dealers/${encodeURIComponent(dealerId)}/performance`,
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown;
    try {
      errBody = await upstream.json();
    } catch {
      errBody = { error: "upstream_error" };
    }
    return NextResponse.json(errBody, { status: upstream.status });
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

  // Backend may return the object directly — wrap into envelope.
  if (json && typeof json === "object" && !("performance" in (json as object))) {
    json = { performance: json };
  }

  const parsed = DealerPerformanceResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
