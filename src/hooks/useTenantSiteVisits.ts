"use client";

import { useQuery } from "@tanstack/react-query";
import {
  TenantSiteVisitsResponseSchema,
  type SiteVisitStatus,
  type TenantSiteVisitsResponse,
} from "@/types/api";

export interface UseTenantSiteVisitsParams {
  /** Inclusive ISO lower bound on `scheduledAt`. */
  from?: string;
  /** Inclusive ISO upper bound on `scheduledAt`. */
  to?: string;
  status?: SiteVisitStatus;
  assignedAgentId?: string;
  projectId?: string;
  enabled?: boolean;
}

function buildQs(params: UseTenantSiteVisitsParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "enabled") continue;
    if (v != null && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

async function fetchTenantSiteVisits(
  qs: string,
): Promise<TenantSiteVisitsResponse> {
  const url = qs ? `/api/site-visits/calendar?${qs}` : "/api/site-visits/calendar";
  const res = await fetch(url);
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`site_visits_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = TenantSiteVisitsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("site_visits_shape_mismatch");
  return parsed.data;
}

/**
 * Tenant-wide site visits for the calendar view — NOT scoped to a booking.
 *
 * `useSiteVisits` (booking-scoped) stays as-is; this is the all-visits
 * counterpart used by /dashboard/site-visits.
 */
export function useTenantSiteVisits(params: UseTenantSiteVisitsParams = {}) {
  const qs = buildQs(params);
  return useQuery<TenantSiteVisitsResponse, Error>({
    queryKey: ["site-visits", "calendar", qs],
    queryFn: () => fetchTenantSiteVisits(qs),
    enabled: params.enabled ?? true,
    staleTime: 25_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
