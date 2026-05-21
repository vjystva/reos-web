import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

/**
 * PATCH /api/notifications/:notificationId/read — marks a single notification
 * as read. Backend returns 204 or 200; we forward the upstream status.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { notificationId: string } },
): Promise<NextResponse> {
  const { notificationId } = ctx.params;
  if (!notificationId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const upstream = await proxyFetch(
    req,
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
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

  return NextResponse.json({ ok: true }, { status: 200 });
}
