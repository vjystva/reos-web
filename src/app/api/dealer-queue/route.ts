import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/dealer-queue");

  if (upstream.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!upstream.ok) return NextResponse.json({ error: "upstream_error" }, { status: upstream.status });

  const json = await upstream.json().catch(() => []);
  const data = Array.isArray(json) ? json : (json as { data?: unknown[] }).data ?? [];
  return NextResponse.json({ data }, { status: 200 });
}
