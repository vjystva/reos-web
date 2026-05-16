import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { LeadSchema } from "@/types/api";
import { isDemoRequest, getDemoLead } from "@/lib/demo";

/**
 * GET /api/leads/[id] — proxies to backend /leads/:id.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  if (isDemoRequest(req)) {
    const lead = getDemoLead(id);
    if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(lead, { status: 200 });
  }

  const upstream = await proxyFetch(req, `/leads/${encodeURIComponent(id)}`);

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

  const parsed = LeadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
