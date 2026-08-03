import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/api";
import { AssistantChatRequestSchema } from "@/types/api";

/**
 * BFF route for the internal AI assistant.
 *
 * This is a dedicated fetch — NOT proxyFetch — because the target is
 * reos-ai-service (port 8001), not reos-backend, and it uses a different auth
 * scheme (X-Service-Key) plus a separately-forwarded user JWT. proxyFetch's
 * backend-specific refresh/retry logic does not apply here.
 *
 * Auth forwarding (two credentials):
 *   - X-Service-Key: the shared BFF -> ai-service secret (AI_SERVICE_KEY).
 *   - Authorization: the END USER's own JWT, read here from the httpOnly
 *     `reos_token` cookie and forwarded as a header so ai-service's read-only
 *     tools call reos-backend scoped to this exact user. The JWT never appears
 *     in the client-side request body and is never logged.
 */

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_BASE_URL ?? "http://localhost:8001";
}

function aiServiceKey(): string {
  return process.env.AI_SERVICE_KEY ?? "dev-secret-key";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = AssistantChatRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${aiServiceBaseUrl()}/assistant/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": aiServiceKey(),
        // Forward the user's JWT as a header (never a body field).
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "ai_service_unreachable" },
      { status: 502 },
    );
  }

  // Pass through the upstream status + JSON body (503 when the assistant is
  // unconfigured, 401 if the token is rejected, etc.).
  const bodyText = await upstream.text();
  let body: unknown;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { error: "ai_service_bad_response" };
  }
  return NextResponse.json(body, { status: upstream.status });
}
