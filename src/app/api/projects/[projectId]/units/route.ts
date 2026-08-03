import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import {
  UnitsResponseSchema,
  UnitSchema,
  CreateUnitRequestSchema,
} from "@/types/api";
import { isDemoRequest, getDemoUnits } from "@/lib/demo";

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
  if (isDemoRequest(req)) {
    const { searchParams } = new URL(req.url);
    return NextResponse.json(getDemoUnits(projectId, searchParams), { status: 200 });
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

/**
 * POST /api/projects/[projectId]/units — create a unit. Dispatches on the
 * optional `towerId` in the body:
 *
 *   towerId present → upstream POST /projects/:id/towers/:towerId/units (apartment)
 *   towerId absent  → upstream POST /projects/:id/units (villa / plotted)
 *
 * `towerId` is stripped from the forwarded body on the apartment path (it moves
 * into the URL); the backend also accepts it in the body, but keeping the URL
 * authoritative matches the GET dispatch above.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { projectId: string } },
): Promise<NextResponse> {
  const { projectId } = ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "missing_project_id" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateUnitRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { towerId, ...unitBody } = parsed.data;
  const backendPath = towerId
    ? `/projects/${encodeURIComponent(projectId)}/towers/${encodeURIComponent(
        towerId,
      )}/units`
    : `/projects/${encodeURIComponent(projectId)}/units`;

  const upstream = await proxyFetch(req, backendPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(unitBody),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try { errBody = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let created: unknown;
  try {
    created = await upstream.json();
  } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  const parsedUnit = UnitSchema.safeParse(created);
  if (!parsedUnit.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(parsedUnit.data, { status: 201 });
}
