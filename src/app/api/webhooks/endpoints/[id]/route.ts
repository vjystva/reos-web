import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

/**
 * DELETE /api/webhooks/endpoints/[id] — remove a registered webhook endpoint.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const upstream = await proxyFetch(
    req,
    `/webhooks/endpoints/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

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
