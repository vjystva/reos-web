import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { LeadsResponseSchema, LeadResponseSchema, CreateLeadRequestSchema } from "@/types/api";
import { isDemoRequest, getDemoLeads } from "@/lib/demo";

/**
 * GET /api/leads — proxies to backend /leads with query params passed through.
 * Response is validated against LeadsResponseSchema; on shape mismatch a 502
 * is returned so failures are loud, not silent.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isDemoRequest(req)) {
    const { searchParams } = new URL(req.url);
    return NextResponse.json(getDemoLeads(searchParams), { status: 200 });
  }

  const url = new URL(req.url);
  const qs = url.search; // includes leading "?" or empty string
  const upstream = await proxyFetch(req, `/leads${qs}`);

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

  const parsed = LeadsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * POST /api/leads — create a new lead.
 * Validates body against CreateLeadRequestSchema then proxies to POST /leads.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateLeadRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, "/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try { errBody = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  const parsedLead = LeadResponseSchema.safeParse(json);
  if (!parsedLead.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(parsedLead.data, { status: 201 });
}
