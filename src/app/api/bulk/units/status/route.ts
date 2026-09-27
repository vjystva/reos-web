import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { BulkResultSchema, BulkUnitStatusRequestSchema } from "@/types/api";

/**
 * POST /api/bulk/units/status — bulk unit status change (block / release a
 * whole floor or tower in one call). Proxies to backend
 * `POST /bulk/units/status`.
 *
 * The backend is the authoritative check for allowed transitions, the
 * per-target role gate, and the required-note rule; this route only validates
 * the envelope shape (and the 100-item cap, to save a round trip) and forwards
 * the per-item results untouched.
 *
 * Note the status semantics: a 200 with `failed > 0` is the normal
 * partial-success response. Do not translate it into an error — the caller
 * needs the per-item reasons.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BulkUnitStatusRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, "/bulk/units/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try {
      errBody = await upstream.json();
    } catch {
      /* keep default */
    }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let result: unknown;
  try {
    result = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  const parsedResult = BulkResultSchema.safeParse(result);
  if (!parsedResult.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsedResult.data, { status: 200 });
}
