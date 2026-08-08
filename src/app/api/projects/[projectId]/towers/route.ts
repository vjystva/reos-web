import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import {
  TowersResponseSchema,
  TowerSchema,
  CreateTowerRequestSchema,
} from "@/types/api";
import { isDemoRequest, getDemoTowers } from "@/lib/demo";

/**
 * GET /api/projects/[projectId]/towers — proxies to backend
 * /projects/:id/towers. Response is the canonical paginated envelope
 * `{ data: Tower[], total, page, pageSize }` (single shape, no union — per
 * backend review B1).
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
    return NextResponse.json(getDemoTowers(projectId), { status: 200 });
  }

  const upstream = await proxyFetch(
    req,
    `/projects/${encodeURIComponent(projectId)}/towers`,
  );

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

  // Backend returns a bare array; wrap into paginated envelope.
  if (Array.isArray(json)) {
    json = { data: json, total: (json as unknown[]).length };
  }

  const parsed = TowersResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * POST /api/projects/[projectId]/towers — create a tower.
 *
 * Proxies verbatim to backend `POST /projects/:projectId/towers`
 * (`TowersController.create`, `@Roles('builder_admin')`), which takes
 * `{ name, totalFloors, facingDirection? }` and returns a single
 * `TowerResponseDto` — a bare object, NOT an envelope, unlike the GET above.
 *
 * Upstream error bodies are forwarded as-is so the client can surface the
 * real message (e.g. the 409 "A tower with this name already exists in this
 * project"), matching the units POST route's behaviour.
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

  const parsedBody = CreateTowerRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(
    req,
    `/projects/${encodeURIComponent(projectId)}/towers`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedBody.data),
    },
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try {
      errBody = await upstream.json();
    } catch {
      /* keep default */
    }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let created: unknown;
  try {
    created = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  const parsedTower = TowerSchema.safeParse(created);
  if (!parsedTower.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsedTower.data, { status: 201 });
}
