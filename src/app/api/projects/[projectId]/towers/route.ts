import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { TowersResponseSchema } from "@/types/api";
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
  const parsed = TowersResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
