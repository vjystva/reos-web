import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { UnitSchema, TransitionUnitStatusRequestSchema } from "@/types/api";

/**
 * PATCH /api/projects/[projectId]/units/[unitId]/status — transition a unit's
 * status. Proxies to backend PATCH /projects/:id/units/:unitId/status. The
 * backend is the authoritative check for allowed transitions, role gating, and
 * the required-note rule; this route just forwards and surfaces its errors.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { projectId: string; unitId: string } },
): Promise<NextResponse> {
  const { projectId, unitId } = ctx.params;
  if (!projectId || !unitId) {
    return NextResponse.json({ error: "missing_ids" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = TransitionUnitStatusRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(
    req,
    `/projects/${encodeURIComponent(projectId)}/units/${encodeURIComponent(
      unitId,
    )}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    },
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try { errBody = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let updated: unknown;
  try {
    updated = await upstream.json();
  } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  const parsedUnit = UnitSchema.safeParse(updated);
  if (!parsedUnit.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(parsedUnit.data, { status: 200 });
}
