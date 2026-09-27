import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import {
  ApprovalSchema,
  ApprovalsResponseSchema,
  CreateApprovalRequestSchema,
} from "@/types/api";

/**
 * GET /api/approvals — proxy of `GET /approvals?status=&type=`.
 *
 * The backend scopes the result by the CALLER'S ROLE: a sales_agent gets only
 * the requests they raised, a sales_manager / builder_admin gets the whole
 * tenant queue. Nothing about that scoping is done here — the BFF must not
 * reimplement it, or the two would drift.
 *
 * `proxyFetch` returns the upstream `Response` (see src/lib/api.ts), so it has
 * to be `await upstream.json()`-ed before validation. Passing the Response
 * object itself to `safeParse` always fails and turns every 200 into a 502.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const qs = new URL(req.url).search;
  const upstream = await proxyFetch(req, `/approvals${qs}`);

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
  const parsed = ApprovalsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * POST /api/approvals — raise a request (`sales_agent`, `sales_manager`,
 * `builder_admin` upstream).
 *
 * Upstream 4xx bodies are forwarded verbatim: the messages are the product
 * ("a discount of 2% or less does not require approval", "hold … is released —
 * only an active hold can be extended", "a pending hold_extension already
 * exists for this hold"), and flattening them to a generic error would leave
 * the user with no idea what to change.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsedBody = CreateApprovalRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, "/approvals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsedBody.data),
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

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  const parsed = ApprovalSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 201 });
}
