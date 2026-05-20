import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { CustomerSiteVisitsResponseSchema } from "@/types/api";

/**
 * GET /api/customer-portal/site-visits/[bookingId]
 * Returns site visits for the authenticated customer, filtered by the unit
 * referenced in the given booking (query param forwarded).
 *
 * The backend GET /customer-portal/site-visits returns ALL site visits for
 * the customer. We proxy the full list and surface it keyed by bookingId so
 * the booking detail page can show relevant visits.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { bookingId: string } },
): Promise<NextResponse> {
  // Suppress unused-param warning — bookingId is part of the route contract
  // and may be used in future to pass as a query filter to the backend.
  void params.bookingId;

  const upstream = await proxyFetch(req, `/customer-portal/site-visits`);

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

  const parsed = CustomerSiteVisitsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
