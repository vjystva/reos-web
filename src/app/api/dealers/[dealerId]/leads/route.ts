import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

/**
 * GET /api/dealers/[dealerId]/leads — leads assigned to a dealer.
 * Pass-through proxy.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dealerId: string }> },
): Promise<NextResponse> {
  const { dealerId } = await params;
  const upstream = await proxyFetch(
    req,
    `/dealers/${encodeURIComponent(dealerId)}/leads`,
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
  return NextResponse.json(json, { status: 200 });
}
