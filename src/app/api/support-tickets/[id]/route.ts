import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { SupportTicketSchema } from "@/types/api";

/**
 * GET /api/support-tickets/[id] — single ticket (with replies).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const upstream = await proxyFetch(
    req,
    `/support-tickets/${encodeURIComponent(id)}`,
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

  // Backend returns { ticket: {...}, replies: [] } — flatten to a single object
  if (json !== null && typeof json === "object" && "ticket" in (json as object)) {
    const envelope = json as { ticket: unknown; replies?: unknown[] };
    json = { ...(envelope.ticket as object), replies: envelope.replies ?? [] };
  }

  const parsed = SupportTicketSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
