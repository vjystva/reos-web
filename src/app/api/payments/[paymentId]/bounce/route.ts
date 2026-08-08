import { NextRequest, NextResponse } from "next/server";
import { proxyFetch, ACCESS_COOKIE } from "@/lib/api";
import { decodeJwt } from "jose";
import { isDemoRequest } from "@/lib/demo";
import { BouncePaymentRequestSchema } from "@/types/api";

const ALLOWED_ROLES = ["builder_admin", "sales_manager"] as const;

/**
 * POST /api/payments/[paymentId]/bounce
 * Body: { bookingId }
 *
 * Marks a payment as bounced. Role-restricted to builder_admin and
 * sales_manager (defence-in-depth: backend enforces the same role).
 *
 * There is no `/payments/:id/bounce` endpoint upstream — that URL 404s. The
 * real capability is `PATCH /bookings/:bookingId/payments/:paymentId/status`
 * with `{ toStatus: 'bounced' }` (`MarkPaymentStatusDto`, which only accepts
 * `bounced` in v1). `bookingId` therefore has to come from the caller; the
 * payment-history table already knows it.
 *
 * Feasibility MC-1: BFF decodes reos_token and returns 403 immediately
 * if the caller's role is not in ALLOWED_ROLES. Upstream is never called
 * for unauthorised callers.
 *
 * Upstream 4xx/5xx (e.g., 422 already bounced, 404 not found) are passed
 * through to the browser with body intact (mandatory fix B1).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
): Promise<NextResponse> {
  const { paymentId } = await params;

  // Role enforcement (Feasibility MC-1).
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    try {
      const claims = decodeJwt(token);
      const role = claims["role"] as string | undefined;
      if (role && !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } catch {
      // Malformed JWT — let proxyFetch handle the 401.
    }
  }

  let rawBody: unknown = {};
  try {
    rawBody = await req.json();
  } catch {
    // Body is optional-shaped here; the bookingId check below reports it.
  }
  const parsedBody = BouncePaymentRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", message: "bookingId is required" },
      { status: 400 },
    );
  }

  if (isDemoRequest(req)) {
    // Demo mode: return synthetic bounce confirmation.
    return NextResponse.json({ status: "bounced" }, { status: 200 });
  }

  const upstream = await proxyFetch(
    req,
    `/bookings/${encodeURIComponent(parsedBody.data.bookingId)}/payments/${encodeURIComponent(paymentId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "bounced" }),
    },
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Pass through upstream body + status intact (mandatory fix B1).
  let upstreamBody: unknown;
  try {
    upstreamBody = await upstream.json();
  } catch {
    upstreamBody = {};
  }

  return NextResponse.json(upstreamBody, { status: upstream.status });
}
