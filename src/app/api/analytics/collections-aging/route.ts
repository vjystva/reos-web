import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { CollectionsAgingResponseSchema } from "@/types/api";

/**
 * GET /api/analytics/collections-aging — proxies to backend
 * /analytics/collections-aging. Forwards the optional ?limit= param, which caps
 * the per-milestone detail list only (bucket totals are always complete).
 *
 * A 404 is NOT turned into an empty payload here: unlike leads-by-source (where
 * the route genuinely did not exist for a while), a missing endpoint would mean
 * a deploy skew, and silently rendering four zero buckets would look exactly
 * like "nothing is overdue" — the single most misleading state this report can
 * be in. Surface it as an error instead.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  if (searchParams.has("limit")) qs.set("limit", searchParams.get("limit")!);

  const path = qs.toString()
    ? `/analytics/collections-aging?${qs.toString()}`
    : "/analytics/collections-aging";

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

  const parsed = CollectionsAgingResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
