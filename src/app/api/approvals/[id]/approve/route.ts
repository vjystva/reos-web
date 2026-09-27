import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import {
  ResolveApprovalRequestSchema,
  ResolvedApprovalSchema,
} from "@/types/api";

/**
 * PATCH /api/approvals/[id]/approve — approve AND apply.
 *
 * Upstream: `PATCH /approvals/:id/approve` (sales_manager | builder_admin).
 * Approve and reject are separate endpoints rather than one status PATCH
 * because they do different things: approving mutates the booking's
 * `discount_percent` or the hold's `expires_at` inside the same transaction
 * that stamps the approval; rejecting touches nothing else.
 *
 * Non-2xx bodies are forwarded as-is — 403 "you cannot resolve an approval
 * request you raised yourself", 409 "hold … is no longer active", 409 "already
 * approved" are all actionable messages for the user.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // An empty body is legitimate (no note) — treat unparseable/absent as {}.
  let rawBody: unknown = {};
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }

  const parsedBody = ResolveApprovalRequestSchema.safeParse(rawBody ?? {});
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(
    req,
    `/approvals/${encodeURIComponent(id)}/approve`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedBody.data),
    },
  );

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
  const parsed = ResolvedApprovalSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
