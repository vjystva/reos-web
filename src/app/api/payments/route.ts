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
 * Proxies to GET /payments?bookingId= on the backend.
 * Returns payment history for the booking, newest-first.
 * Returns 400 if bookingId is missing.
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

  // Forward with sort=createdAt&order=desc if backend supports it (N2 from backend review).
  const qs = new URLSearchParams(url.searchParams);
  if (!qs.has("sort")) qs.set("sort", "createdAt");
  if (!qs.has("order")) qs.set("order", "desc");

  const upstream = await proxyFetch(req, `/payments?${qs.toString()}`);

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
 * Records a payment against a milestone.
 * Body: { milestoneId, amount, mode, referenceNumber?, notes? }
 *
 * Behaviour:
 *  - 400 on Zod validation failure (no upstream call) — mandatory fix B2.
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

  const upstream = await proxyFetch(req, "/payments", {
    method: "POST",
    body: JSON.stringify(bodyParsed.data),
    headers: { "Content-Type": "application/json" },
  });

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
