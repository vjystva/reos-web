import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import {
  CommunicationLogSchema,
  SendCommunicationRequestSchema,
} from "@/types/api";

/**
 * POST /api/communications/send — send a message (test or real).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsedBody = SendCommunicationRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, "/communications/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsedBody.data),
  });

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

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  // Backend may return the log or an envelope; accept either.
  const parsed = CommunicationLogSchema.safeParse(json);
  if (!parsed.success) {
    // Fall back to passing the body through if it isn't a full log shape
    // (e.g. backend returns { ok: true } for async queued sends).
    return NextResponse.json(json as object, { status: 200 });
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
