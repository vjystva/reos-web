import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { CommunicationLogsResponseSchema } from "@/types/api";

/**
 * GET /api/communications/logs?status=&channel=&page=&limit=
 * Proxies to GET /communications/logs.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const qs = url.search;
  const upstream = await proxyFetch(req, `/communications/logs${qs}`);

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

  if (Array.isArray(json)) {
    json = { data: json, total: (json as unknown[]).length };
  }

  const parsed = CommunicationLogsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
