import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import {
  BookingsResponseSchema,
  BookingCreatedSchema,
  CreateBookingRequestSchema,
} from "@/types/api";
import { isDemoRequest, getDemoBookings } from "@/lib/demo";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isDemoRequest(req)) return NextResponse.json(getDemoBookings(), { status: 200 });

  const url = new URL(req.url);
  const qs = url.search;
  const upstream = await proxyFetch(req, `/bookings${qs}`);

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
  const parsed = BookingsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * POST /api/bookings — initiates a booking against a unit + lead.
 *
 *   body: { leadId: string, unitId: string, bookingAmount?: number }
 *
 * Behaviour:
 *  - 400 on body validation failure (no upstream call).
 *  - 401 returned to browser if upstream auth fails (proxyFetch handles refresh).
 *  - 409 passed through with upstream body intact so the client can surface
 *    "this unit was just booked by another agent" toast (spec AC #14).
 *  - 502 on shape mismatch (strict BookingCreatedSchema requires id + unitId).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsedBody = CreateBookingRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsedBody.error.issues },
      { status: 400 },
    );
  }
  if (isDemoRequest(req)) {
    return NextResponse.json({
      id: `bk-demo-${Date.now()}`,
      bookingNumber: `BK${Date.now()}`,
      status: "confirmed",
      unitId: parsedBody.data.unitId,
      leadId: parsedBody.data.leadId,
    }, { status: 201 });
  }

  const upstream = await proxyFetch(req, "/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsedBody.data),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Pass 409 (and other 4xx) through with body intact so client toasts can
  // surface upstream messages.
  if (upstream.status === 409) {
    let conflictBody: unknown = { error: "conflict" };
    try {
      conflictBody = await upstream.json();
    } catch {
      // keep default body
    }
    return NextResponse.json(conflictBody, { status: 409 });
  }

  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try {
      errBody = await upstream.json();
    } catch {
      // keep default body
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
  const parsed = BookingCreatedSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 201 });
}
