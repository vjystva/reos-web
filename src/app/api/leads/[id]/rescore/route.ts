import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const upstream = await proxyFetch(req, `/leads/${id}/rescore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  if (upstream.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (upstream.status === 404) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!upstream.ok) {
    let err: unknown = { error: "upstream_error" };
    try { err = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(err, { status: upstream.status });
  }

  const json = await upstream.json().catch(() => ({}));
  return NextResponse.json(json, { status: 200 });
}
