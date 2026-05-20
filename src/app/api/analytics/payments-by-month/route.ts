import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { PaymentsByMonthResponseSchema } from "@/types/api";

/**
 * GET /api/analytics/payments-by-month?year=<year> — proxies to backend
 * /analytics/payments-by-month. Forwards the year query param.
 * Returns { data: [] } on upstream 404.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");

  const qs = new URLSearchParams();
  if (year) qs.set("year", year);

  const path = qs.toString()
    ? `/analytics/payments-by-month?${qs.toString()}`
    : "/analytics/payments-by-month";

  const upstream = await proxyFetch(req, path);

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (upstream.status === 404) {
    return NextResponse.json({ data: [] }, { status: 200 });
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

  const parsed = PaymentsByMonthResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  return NextResponse.json(parsed.data, { status: 200 });
}
