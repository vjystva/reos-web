import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { CustomerDocumentsResponseSchema } from "@/types/api";

/**
 * GET /api/customer-portal/documents/[bookingId]
 * Returns all documents attached to the specified booking for the
 * authenticated customer.
 * Proxies to backend GET /customer-portal/documents?bookingId=:bookingId.
 *
 * Note: The backend /customer-portal/documents endpoint returns ALL documents
 * for the customer. We filter by resourceId (bookingId) on the BFF layer.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { bookingId: string } },
): Promise<NextResponse> {
  const { bookingId } = params;

  const upstream = await proxyFetch(req, `/customer-portal/documents`);

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

  const parsed = CustomerDocumentsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  // Filter to only documents belonging to this booking.
  const filtered = parsed.data.filter((d) => d.resourceId === bookingId);
  return NextResponse.json(filtered, { status: 200 });
}
