import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import {
  PaymentsResponseSchema,
  RecordPaymentRequestSchema,
  RecordPaymentResponseSchema,
} from "@/types/api";
import { isDemoRequest, getDemoPayments } from "@/lib/demo";

/**
 * GET /api/payments?bookingId=<id>
 *
 * Proxies to `GET /bookings/:bookingId/payments` on the backend
 * (`PaymentsController.list`, `ListPaymentsDto`).
 *
 * There is NO top-level `/payments` collection upstream — every payment route
 * is nested under its booking. This route used to call
 * `GET /payments?bookingId=…`, which 404s ("Cannot GET /payments"), so the
 * payment-history table on the booking payments page never loaded.
 *
 * `ListPaymentsDto` whitelists only `milestoneId | status | page | pageSize`
 * and the backend runs `forbidNonWhitelisted`, so `bookingId`/`sort`/`order`
 * must NOT be forwarded — they were also part of the original 400/404.
 * Ordering is newest-first upstream already.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const bookingId = url.searchParams.get("bookingId");

  if (!bookingId) {
    return NextResponse.json(
      { error: "bookingId query param is required" },
      { status: 400 },
    );
  }

  if (isDemoRequest(req)) {
    return NextResponse.json(getDemoPayments(bookingId), { status: 200 });
  }

  // Forward only the params ListPaymentsDto accepts.
  const qs = new URLSearchParams();
  for (const key of ["milestoneId", "status", "page", "pageSize"]) {
    const v = url.searchParams.get(key);
    if (v) qs.set(key, v);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const upstream = await proxyFetch(
    req,
    `/bookings/${encodeURIComponent(bookingId)}/payments${suffix}`,
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    const body = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "upstream_error", message: body },
      { status: upstream.status },
    );
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  if (Array.isArray(json)) {
    json = { data: json, total: (json as unknown[]).length };
  }

  const parsed = PaymentsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * POST /api/payments
 *
 * Records a payment against a milestone. Proxies to
 * `POST /bookings/:bookingId/payments` (`RecordPaymentDto`).
 *
 * Body: { bookingId, milestoneId, amount, paymentDate, paymentMode,
 *         referenceNumber?, notes? }
 *
 * `bookingId` is consumed here to build the upstream path and is STRIPPED
 * before forwarding — the backend's `forbidNonWhitelisted` validator answers
 * 400 "property bookingId should not exist" otherwise.
 *
 * Behaviour:
 *  - 400 on Zod validation failure (no upstream call).
 *  - 401 returned to browser if upstream auth fails.
 *  - 4xx/5xx from upstream passed through with body intact.
 *  - 502 on upstream shape mismatch.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bodyParsed = RecordPaymentRequestSchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: bodyParsed.error.flatten() },
      { status: 400 },
    );
  }

  if (isDemoRequest(req)) {
    // Demo mode: return a synthetic receipt
    return NextResponse.json(
      {
        id: `pay-demo-${Date.now()}`,
        receiptNumber: `RCP-0001-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`,
        status: "cleared",
      },
      { status: 201 },
    );
  }

  const { bookingId, ...upstreamBody } = bodyParsed.data;

  const upstream = await proxyFetch(
    req,
    `/bookings/${encodeURIComponent(bookingId)}/payments`,
    {
      method: "POST",
      body: JSON.stringify(upstreamBody),
      headers: { "Content-Type": "application/json" },
    },
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Pass through non-2xx upstream errors (e.g., 409 conflict) with body intact.
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
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  const parsed = RecordPaymentResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  return NextResponse.json(parsed.data, { status: upstream.status });
}
