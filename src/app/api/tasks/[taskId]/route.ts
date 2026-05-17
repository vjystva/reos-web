import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { TaskSchema, UpdateTaskRequestSchema } from "@/types/api";

/**
 * GET /api/tasks/[taskId] — single task.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<NextResponse> {
  const { taskId } = await params;

  const upstream = await proxyFetch(req, `/tasks/${encodeURIComponent(taskId)}`);

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
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  const parsed = TaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * PATCH /api/tasks/[taskId] — partial update.
 * Body validated against UpdateTaskRequestSchema.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<NextResponse> {
  const { taskId } = await params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = UpdateTaskRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, `/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let upstreamBody: unknown;
  try {
    upstreamBody = await upstream.json();
  } catch {
    upstreamBody = {};
  }

  return NextResponse.json(upstreamBody, { status: upstream.status });
}

/**
 * DELETE /api/tasks/[taskId]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<NextResponse> {
  const { taskId } = await params;

  const upstream = await proxyFetch(req, `/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try {
      errBody = await upstream.json();
    } catch {
      // keep default
    }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
