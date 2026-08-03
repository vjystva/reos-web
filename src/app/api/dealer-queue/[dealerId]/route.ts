import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ dealerId: string }> },
): Promise<NextResponse> {
  const { dealerId } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const upstream = await proxyFetch(req, `/dealer-queue/${dealerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (upstream.status === 401) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!upstream.ok) {
    let err: unknown = { error: "upstream_error" };
    try { err = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(err, { status: upstream.status });
  }

  const json = await upstream.json().catch(() => ({}));
  return NextResponse.json(json, { status: 200 });
}
