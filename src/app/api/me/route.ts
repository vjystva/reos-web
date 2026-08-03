import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { ACCESS_COOKIE, proxyFetch } from "@/lib/api";
import { isDemoRequest, DEMO_USER } from "@/lib/demo";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isDemoRequest(req)) {
    return NextResponse.json({
      role: "builder_admin",
      email: DEMO_USER.email,
      tenantId: DEMO_USER.tenantId,
      tenantName: "reOS Demo",
    });
  }

  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // The access token only carries sub/tenantId/role (no email or tenant
  // name), so fetch the real values from the backend rather than decoding
  // the JWT — decoding alone previously left the UI displaying raw UUIDs.
  const backendRes = await proxyFetch(req, "/auth/me");
  if (backendRes.ok) {
    const data = await backendRes.json();
    return NextResponse.json({
      role: data.role ?? null,
      email: data.email ?? null,
      tenantId: data.tenantId ?? null,
      tenantName: data.tenantName ?? null,
    });
  }

  // Backend unreachable/erroring — fall back to whatever the token itself
  // carries so the app degrades instead of hard-failing.
  try {
    const payload = decodeJwt(token);
    return NextResponse.json({
      role: payload.role ?? null,
      email: null,
      tenantId: payload.tenantId ?? null,
      tenantName: null,
    });
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
}
