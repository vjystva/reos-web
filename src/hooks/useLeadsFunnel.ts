"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LeadsFunnelResponseSchema,
  type LeadsFunnelResponse,
} from "@/types/api";

/**
 * Optional cohort bounds on lead `createdAt`, as ISO-8601 strings. Either may
 * be given on its own.
 */
export interface FunnelRange {
  from?: string;
  to?: string;
}

async function fetchLeadsFunnel(
  range?: FunnelRange,
): Promise<LeadsFunnelResponse> {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const url = qs.toString()
    ? `/api/analytics/leads-funnel?${qs.toString()}`
    : "/api/analytics/leads-funnel";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`leads_funnel_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = LeadsFunnelResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("leads_funnel_shape_mismatch");
  return parsed.data;
}

/**
 * Lead counts by pipeline stage.
 *
 * Called with no argument (the dashboard / analytics pages) this is a
 * CURRENT-STATE view over every lead in the tenant, regardless of when it was
 * created — which is what "Open pipeline" means. Pass a range only when you
 * genuinely want an acquisition cohort (the Reports page range selector).
 */
export function useLeadsFunnel(range?: FunnelRange) {
  const key = range?.from || range?.to ? { from: range.from ?? null, to: range.to ?? null } : null;
  return useQuery({
    queryKey: ["analytics", "leads-funnel", key],
    queryFn: () => fetchLeadsFunnel(range),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
