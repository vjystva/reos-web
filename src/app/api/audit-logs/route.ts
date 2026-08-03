import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const qs = url.search;
  const upstream = await proxyFetch(req, `/audit-logs${qs}`);

  if (upstream.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!upstream.ok) return NextResponse.json({ error: "upstream_error" }, { status: upstream.status });

  let json: unknown;
  try { json = await upstream.json(); } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  if (Array.isArray(json)) json = { data: json, hasMore: false };
  return NextResponse.json(json, { status: 200 });
}
