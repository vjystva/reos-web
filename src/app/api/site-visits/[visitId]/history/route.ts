import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { z } from "zod";
import { SiteVisitHistorySchema } from "@/types/api";

const HistoryListSchema = z.array(SiteVisitHistorySchema);

/**
 * GET /api/site-visits/[visitId]/history
 *
 * Returns the status history for a visit. Backend may return either a bare
 * array or a paginated envelope; we normalise to `{ data, total }`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ visitId: string }> },
): Promise<NextResponse> {
  const { visitId } = await params;

  const upstream = await proxyFetch(req, `/site-visits/${visitId}/history`);

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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

  // Normalise: backend may return a bare array OR a paginated envelope.
  let listCandidate: unknown = json;
  if (
    json &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    "data" in (json as Record<string, unknown>) &&
    Array.isArray((json as { data: unknown }).data)
  ) {
    listCandidate = (json as { data: unknown[] }).data;
  }

  const parsed = HistoryListSchema.safeParse(listCandidate);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  return NextResponse.json(
    { data: parsed.data, total: parsed.data.length },
    { status: 200 },
  );
}
