import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  doRefresh,
} from "@/lib/api";

const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Direct refresh endpoint. Reads the `reos_refresh` cookie, calls the
 * upstream `/auth/refresh`, rewrites the access cookie. Returns 200 on
 * success or 401 (with cleared cookies) on failure.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value ?? "";
  if (!refreshToken) {
    const res = NextResponse.json({ error: "no_refresh_token" }, { status: 401 });
    res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  const result = await doRefresh(refreshToken);
  if (!result) {
    const isProd = process.env.NODE_ENV === "production";
    const res = NextResponse.json({ error: "refresh_failed" }, { status: 401 });
    res.cookies.set(ACCESS_COOKIE, "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set(REFRESH_COOKIE, "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  const isProd = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(ACCESS_COOKIE, result.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_ACCESS_TTL_SECONDS,
  });
  // The refresh token is ROTATED server-side on every use — the old one is
  // revoked the instant this call succeeds. Not persisting the new one here
  // means the next refresh attempt presents an already-revoked token, which
  // the backend treats as replay and burns the entire token family,
  // permanently killing the session. See src/lib/api.ts's module doc.
  if (result.refreshToken) {
    res.cookies.set(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_MAX_AGE_SECONDS,
    });
  }
  return res;
}
