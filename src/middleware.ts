import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";

const ACCESS_COOKIE = "reos_token";

/**
 * Route protection.
 *
 * Protected routes: /dashboard/**
 * Public routes:    /login, /api/**, static assets
 *
 * If no token → redirect to /login.
 * If token expired → still allow the request through. The BFF proxy on the
 * next data call will attempt a refresh; if that fails the proxy returns 401
 * and the client redirects. Edge-runtime cookie mutation does not play well
 * with in-flight API calls, so we deliberately do NOT refresh here.
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;

  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Lightweight decode-only check. Verification stays on the backend.
  try {
    const payload = decodeJwt(token);
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    const now = Math.floor(Date.now() / 1000);
    if (exp && exp < now - 60 * 60 * 24 * 7) {
      // Token is more than a week past expiry → treat as fully invalid.
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  } catch {
    // Unparseable token — force re-login.
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
