import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { TopDealersResponseSchema } from "@/types/api";

/**
 * GET /api/analytics/top-dealers — proxies to backend /analytics/top-dealers.
 * On upstream 404 returns an empty `{ dealers: [] }` envelope so the UI renders
 * an empty state instead of an error while the backend endpoint is still being
 * delivered.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/analytics/top-dealers");

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (upstream.status === 404) {
    return NextResponse.json({ dealers: [] }, { status: 200 });
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
  const parsed = TopDealersResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
