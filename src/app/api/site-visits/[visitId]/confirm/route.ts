import { NextRequest, NextResponse } from "next/server";
import { proxyFetch, ACCESS_COOKIE } from "@/lib/api";
import { decodeJwt } from "jose";

const ALLOWED_ROLES = ["builder_admin", "sales_manager"] as const;

/**
 * POST /api/site-visits/[visitId]/confirm
 *
 * Role-restricted (defence-in-depth) to builder_admin and sales_manager.
 * Backend enforces the same role boundary.
 *
 * Upstream non-2xx (e.g., 409 already-confirmed) is passed through with
 * body intact so the UI can surface the message.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ visitId: string }> },
): Promise<NextResponse> {
  const { visitId } = await params;

  // Role gate (defence-in-depth).
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    try {
      const claims = decodeJwt(token);
      const role = claims["role"] as string | undefined;
      if (role && !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } catch {
      // Malformed JWT — fall through to proxyFetch's 401 path.
    }
  }

  const upstream = await proxyFetch(req, `/site-visits/${visitId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let upstreamBody: unknown;
  try {
    upstreamBody = await upstream.json();
  } catch {
    upstreamBody = {};
  }

  return NextResponse.json(upstreamBody, { status: upstream.status });
}
