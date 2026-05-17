import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { RescheduleVisitRequestSchema } from "@/types/api";

/**
 * POST /api/site-visits/[visitId]/reschedule
 * Body: { visitDate, notes? }
 *
 * Validates body with Zod before calling upstream.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ visitId: string }> },
): Promise<NextResponse> {
  const { visitId } = await params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = RescheduleVisitRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, `/site-visits/${visitId}/reschedule`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
    headers: { "Content-Type": "application/json" },
  });

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
