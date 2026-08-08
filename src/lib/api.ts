import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { UpstreamRefreshResponseSchema } from "@/types/api";

/**
 * BFF proxy helpers.
 *
 * Contract:
 *   doRefresh(refreshToken)
 *     → { accessToken, refreshToken? } on success
 *     → null on any failure (network, non-2xx, JSON parse, schema mismatch)
 *     → NEVER throws.
 *
 *   refreshOrRedirect(refreshToken)
 *     uses a singleton in-flight promise to deduplicate concurrent refresh
 *     attempts. After settle, the promise is cleared so a later refresh starts
 *     fresh. Concurrent waiters always receive the same RefreshResult value.
 *
 *   proxyFetch(req, backendPath, init?)
 *     reads `reos_token` cookie, attaches Bearer header, forwards to the
 *     backend. On 401 calls refreshOrRedirect; on success retries the upstream
 *     request once with the freshly-issued accessToken AND persists both
 *     rotated tokens via next/headers' cookies() so they actually reach the
 *     browser — every caller of proxyFetch discards whatever Response object
 *     it returns and builds its own fresh NextResponse.json(...), so setting
 *     cookies on that returned Response would silently do nothing. cookies()
 *     writes into the request-scoped outgoing cookie jar Next.js merges into
 *     whatever response the route handler ultimately returns, independent of
 *     which object that is.
 *
 *     This refresh flow ROTATES the refresh token (backend revokes the
 *     presented one and issues a new one every time; presenting an
 *     already-revoked token burns the entire token family and permanently
 *     kills the session). Before this fix, the rotated pair was never
 *     persisted, so the tab kept resending the now-revoked refresh token on
 *     the very next request, which the backend correctly treated as replay
 *     and burned the family — the user would work for one access-token
 *     lifetime (~15 min), then be hard-logged-out on the next request no
 *     matter what they did. Do not "simplify" this back to only setting the
 *     access-token cookie.
 */

export const ACCESS_COOKIE = "reos_token";
export const REFRESH_COOKIE = "reos_refresh";

export type RefreshResult = { accessToken: string; refreshToken?: string } | null;

const ACCESS_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Resolve the backend base URL at call time (not module-load time) so that
 * jest tests setting process.env.REOS_API_BASE_URL after import still work.
 */
function backendBaseUrl(): string {
  return process.env.REOS_API_BASE_URL ?? "http://localhost:3001";
}

/**
 * Calls the upstream `/auth/refresh` endpoint. Catches every kind of failure
 * (network throw, non-2xx, JSON parse error, schema mismatch) and returns
 * null. Never throws.
 */
export async function doRefresh(
  refreshToken: string,
): Promise<RefreshResult> {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${backendBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return null;
    }
    const parsed = UpstreamRefreshResponseSchema.safeParse(json);
    if (!parsed.success) return null;
    return {
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
    };
  } catch {
    return null;
  }
}

// Singleton in-flight promise. Concurrent callers see the same promise; once
// it settles the slot is cleared so a future refresh starts a new attempt.
let refreshPromise: Promise<RefreshResult> | null = null;

/**
 * Deduplicates concurrent refresh attempts. All callers in the same tick share
 * one underlying doRefresh() call and resolve to the same value (or null).
 */
export async function refreshOrRedirect(
  refreshToken: string,
): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = doRefresh(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Test-only escape hatch — clears the in-flight singleton between test cases.
 * Not part of the production contract.
 */
export function __resetRefreshPromiseForTests(): void {
  refreshPromise = null;
}

// -------------------------------------------------------------------------

function buildAuthHeaders(token: string | undefined, extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (!h.has("Accept")) h.set("Accept", "application/json");
  return h;
}

/**
 * Proxies a single backend request through the BFF. Returns the upstream
 * Response unmodified except: on 401 we transparently attempt one refresh +
 * retry. On terminal 401 (refresh fails) we return a 401 NextResponse with
 * cleared cookies so the client redirects to /login.
 */
export async function proxyFetch(
  req: NextRequest,
  backendPath: string,
  init: RequestInit = {},
): Promise<Response> {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value ?? "";
  const url = `${backendBaseUrl()}${backendPath}`;

  const first = await fetch(url, {
    ...init,
    headers: buildAuthHeaders(accessToken, init.headers),
    cache: "no-store",
  });

  if (first.status !== 401) return first;

  // 401 path — try one refresh.
  const refreshed = await refreshOrRedirect(refreshToken);
  const isProd = process.env.NODE_ENV === "production";
  const jar = await cookies();
  if (!refreshed) {
    // Terminal failure — clear both cookies via the request-scoped jar (NOT
    // via `out.cookies.set()`) so this actually reaches the browser no
    // matter what NextResponse the caller ends up returning.
    jar.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
    jar.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Persist the rotated pair — same reasoning as above. The refresh token is
  // ROTATED server-side on every use; if we don't write the new one back
  // here, the next request on this tab presents the now-revoked old one,
  // the backend treats that as replay and burns the whole token family, and
  // the session is unrecoverably dead from then on (see the module doc).
  jar.set(ACCESS_COOKIE, refreshed.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
  if (refreshed.refreshToken) {
    jar.set(REFRESH_COOKIE, refreshed.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_MAX_AGE_SECONDS,
    });
  }

  // Retry with the freshly-issued accessToken — DO NOT re-read req.cookies
  // (the new cookie lives in the response jar we just wrote, not on `req`).
  const retry = await fetch(url, {
    ...init,
    headers: buildAuthHeaders(refreshed.accessToken, init.headers),
    cache: "no-store",
  });
  return retry;
}
