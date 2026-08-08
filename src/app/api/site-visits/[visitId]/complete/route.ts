import { NextRequest, NextResponse } from "next/server";
import { proxyFetch, ACCESS_COOKIE } from "@/lib/api";
import { decodeJwt } from "jose";

const ALLOWED_ROLES = [
  "builder_admin",
  "sales_manager",
  "sales_agent",
] as const;

/**
 * POST /api/site-visits/[visitId]/complete
 *
 * Marks a confirmed visit as completed. Proxies to
 * `POST /site-visits/:id/complete` (the backend registers BOTH `POST` and
 * `PATCH` on the same handler; POST keeps this route shape-consistent with
 * confirm/reschedule/cancel).
 *
 * Only `confirmed -> completed` is a legal transition upstream
 * (`ALLOWED_VISIT_TRANSITIONS`); anything else answers 422, which is passed
 * through with the body intact so the UI can surface the reason.
 *
 * Role-restricted (defence-in-depth) to the same set the backend's
 * `@Roles('sales_agent', 'sales_manager', 'builder_admin')` allows.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ visitId: string }> },
): Promise<NextResponse> {
  const { visitId } = await params;

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

  const upstream = await proxyFetch(req, `/site-visits/${visitId}/complete`, {
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
