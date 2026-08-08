import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { CancelVisitRequestSchema } from "@/types/api";

/**
 * POST /api/site-visits/[visitId]/cancel
 * Body: { reason }
 *
 * The browser sends `{ reason }`; the backend's `CancelSiteVisitDto` requires
 * `{ cancellationReason }`. Forwarding `reason` verbatim returned
 * 400 "property reason should not exist, cancellationReason should not be
 * empty" (global `forbidNonWhitelisted` ValidationPipe), so the Cancel visit
 * form failed on every submit. Rename here — the UI keeps its own vocabulary.
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

  const parsed = CancelVisitRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, `/site-visits/${visitId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: parsed.data.reason }),
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
