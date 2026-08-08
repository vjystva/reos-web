import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import {
  CreateLeadActivityRequestSchema,
  LeadActivitiesResponseSchema,
} from "@/types/api";

/**
 * Lead activity timeline.
 *
 * The `leads` table has NO `notes` column — backend `UpdateLeadDto` rejects
 * `{ notes }` with 400 "property notes should not exist". A lead note is an
 * activity row (`lead_activities.activity_type = 'note'`), so both reading the
 * timeline and saving a note go through these two backend endpoints:
 *
 *   GET  /leads/:id/activities  -> { data, total, page, pageSize }
 *   POST /leads/:id/activities  -> 201 { id }   body: { activityType, body }
 */

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const upstream = await proxyFetch(
    req,
    `/leads/${encodeURIComponent(id)}/activities`,
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (upstream.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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

  const parsed = LeadActivitiesResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateLeadActivityRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(
    req,
    `/leads/${encodeURIComponent(id)}/activities`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    },
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let upstreamBody: unknown;
  try {
    upstreamBody = await upstream.json();
  } catch {
    upstreamBody = {};
  }

  return NextResponse.json(upstreamBody, { status: upstream.status });
}
