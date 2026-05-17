import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { DocumentSchema } from "@/types/api";

/**
 * GET /api/documents/[documentId] — single document.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  const { documentId } = await params;

  const upstream = await proxyFetch(
    req,
    `/documents/${encodeURIComponent(documentId)}`,
  );

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown;
    try {
      errBody = await upstream.json();
    } catch {
      errBody = { error: "upstream_error" };
    }
    return NextResponse.json(errBody, { status: upstream.status });
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
  const parsed = DocumentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * DELETE /api/documents/[documentId]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  const { documentId } = await params;

  const upstream = await proxyFetch(
    req,
    `/documents/${encodeURIComponent(documentId)}`,
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
