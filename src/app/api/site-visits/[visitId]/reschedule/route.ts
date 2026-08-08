import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { RescheduleVisitRequestSchema } from "@/types/api";

/**
 * POST /api/site-visits/[visitId]/reschedule
 * Body: { visitDate, notes? }
 *
 * Validates body with Zod, then renames to the backend's
 * `RescheduleSiteVisitDto` spelling: `{ newScheduledAt, note? }`.
 *
 * Forwarding `{ visitDate, notes }` verbatim returned 400 "property visitDate
 * should not exist, property notes should not exist, newScheduledAt must be a
 * valid ISO 8601 date string" (global `forbidNonWhitelisted` ValidationPipe),
 * so the Reschedule form failed on every submit.
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

  const upstreamPayload: Record<string, string> = {
    newScheduledAt: parsed.data.visitDate,
  };
  // `note` is an optional non-empty string upstream; omit the key entirely
  // rather than sending "".
  if (parsed.data.notes) upstreamPayload.note = parsed.data.notes;

  const upstream = await proxyFetch(req, `/site-visits/${visitId}/reschedule`, {
    method: "POST",
    body: JSON.stringify(upstreamPayload),
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
