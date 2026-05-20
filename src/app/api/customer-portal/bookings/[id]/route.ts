import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { CustomerBookingSummarySchema } from "@/types/api";

/**
 * GET /api/customer-portal/bookings/[id]
 * Returns a single booking detail for the authenticated customer.
 * Proxies to backend GET /customer-portal/bookings/:id.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = params;

  const upstream = await proxyFetch(req, `/customer-portal/bookings/${id}`);

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

  const parsed = CustomerBookingSummarySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
