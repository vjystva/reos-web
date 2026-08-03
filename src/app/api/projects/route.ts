import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { ProjectsResponseSchema, ProjectSchema, CreateProjectRequestSchema } from "@/types/api";
import { isDemoRequest, getDemoProjects } from "@/lib/demo";

/**
 * GET /api/projects — proxies to backend /projects with query params passed
 * through (page, pageSize, search). Response validated against
 * ProjectsResponseSchema; shape mismatch yields 502.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isDemoRequest(req)) return NextResponse.json(getDemoProjects(), { status: 200 });

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

/**
 * POST /api/projects — create a new project.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateProjectRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, "/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try { errBody = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  const parsedProject = ProjectSchema.safeParse(json);
  if (!parsedProject.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(parsedProject.data, { status: 201 });
}
