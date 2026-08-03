"use client";

import { useQuery } from "@tanstack/react-query";

export interface CurrentUser {
  role: string | null;
  email: string | null;
  tenantId: string | null;
  tenantName: string | null;
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch("/api/me");
  if (!res.ok) {
    // Unauthenticated / invalid token — treat as "no user" rather than throwing,
    // so callers can render a sensible fallback (AppShell shows all nav tabs).
    return { role: null, email: null, tenantId: null, tenantName: null };
  }
  const data = (await res.json()) as Partial<CurrentUser>;
  return {
    role: (data.role as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    tenantId: (data.tenantId as string | null) ?? null,
    tenantName: (data.tenantName as string | null) ?? null,
  };
}

/**
 * Current authenticated user, decoded from the session cookie by `/api/me`.
 * Shared by any component that needs to role-gate UI (nav tabs, the Add-unit
 * button, unit status transitions). Cached for the session — role does not
 * change without a re-login.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
