import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { UnitsResponseSchema } from "@/types/api";

/**
 * GET /api/projects/[projectId]/units — single client-facing units endpoint
 * regardless of project type. Dispatches based on the presence of `?towerId`:
 *
 *   towerId present → upstream GET /projects/:id/towers/:towerId/units
 *   towerId absent  → upstream GET /projects/:id/availability
 *
 * All other query params (status, bedrooms, floorMin, floorMax, priceMin,
 * priceMax, sortBy, page, pageSize) pass through verbatim. The `towerId`
 * itself is stripped from the forwarded query string for the apartment path
 * (it moves into the URL path).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { projectId: string } },
): Promise<NextResponse> {
  const { projectId } = ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "missing_project_id" }, { status: 400 });
  }

  const incoming = new URL(req.url);
  const params = new URLSearchParams(incoming.searchParams);
  const towerId = params.get("towerId");
  params.delete("towerId");
  const qs = params.toString();
  const tail = qs ? `?${qs}` : "";

  const backendPath = towerId
    ? `/projects/${encodeURIComponent(projectId)}/towers/${encodeURIComponent(
        towerId,
      )}/units${tail}`
    : `/projects/${encodeURIComponent(projectId)}/availability${tail}`;

  const upstream = await proxyFetch(req, backendPath);

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
  const parsed = UnitsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
