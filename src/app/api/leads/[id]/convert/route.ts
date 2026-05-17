import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  const upstream = await proxyFetch(
    req,
    `/leads/${encodeURIComponent(id)}/convert`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try { body = await upstream.json(); } catch { body = {}; }
  return NextResponse.json(body, { status: upstream.status });
}
