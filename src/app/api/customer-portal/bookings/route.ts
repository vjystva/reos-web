import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { CustomerBookingsResponseSchema } from "@/types/api";

/**
 * GET /api/customer-portal/bookings
 * Returns the list of bookings for the authenticated customer.
 * Proxies to backend GET /customer-portal/bookings.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/customer-portal/bookings");

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

  const parsed = CustomerBookingsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
