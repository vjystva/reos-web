import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

/**
 * POST /api/notifications/read-all — marks all notifications for the current
 * user as read.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/notifications/read-all", {
    method: "POST",
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_error" },
      { status: upstream.status },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
