import { NextRequest, NextResponse } from "next/server";
import { UpstreamRefreshResponseSchema } from "@/types/api";

/**
 * BFF proxy helpers.
 *
 * Contract:
 *   doRefresh(refreshToken)
 *     → { accessToken } on success
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
 *     request *once* with the freshly-issued accessToken (does NOT re-read
 *     req.cookies — the new cookie lives only on the outgoing response).
 *     On null refresh result, propagates 401 to the browser.
 */

export const ACCESS_COOKIE = "reos_token";
export const REFRESH_COOKIE = "reos_refresh";

export type RefreshResult = { accessToken: string } | null;

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
    return { accessToken: parsed.data.accessToken };
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
  if (!refreshed) {
    const out = NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
    out.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
    out.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
    return out;
  }

  // Retry with the freshly-issued accessToken — DO NOT re-read req.cookies
  // (the new cookie is only on the outgoing response, not the incoming req).
  const retry = await fetch(url, {
    ...init,
    headers: buildAuthHeaders(refreshed.accessToken, init.headers),
    cache: "no-store",
  });
  return retry;
}
