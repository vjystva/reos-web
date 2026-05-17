import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { UnreadCountResponseSchema } from "@/types/api";

/**
 * GET /api/notifications/unread-count — proxies to backend
 * /notifications/unread-count → { count: number }.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/notifications/unread-count");

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
  const parsed = UnreadCountResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
