import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { ProjectsResponseSchema } from "@/types/api";

/**
 * GET /api/projects — proxies to backend /projects with query params passed
 * through (page, pageSize, search). Response validated against
 * ProjectsResponseSchema; shape mismatch yields 502.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const qs = url.search; // includes leading "?" or empty
  const upstream = await proxyFetch(req, `/projects${qs}`);

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
  const parsed = ProjectsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
