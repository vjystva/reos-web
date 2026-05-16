import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { ProjectSchema } from "@/types/api";
import { isDemoRequest, getDemoProject } from "@/lib/demo";

/**
 * GET /api/projects/[projectId] — proxies to backend /projects/:id.
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
    const project = getDemoProject(projectId);
    if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(project, { status: 200 });
  }

  const upstream = await proxyFetch(
    req,
    `/projects/${encodeURIComponent(projectId)}`,
  );

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
  const parsed = ProjectSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
