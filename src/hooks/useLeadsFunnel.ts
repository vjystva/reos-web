"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LeadsFunnelResponseSchema,
  type LeadsFunnelResponse,
} from "@/types/api";

async function fetchLeadsFunnel(): Promise<LeadsFunnelResponse> {
  const res = await fetch("/api/analytics/leads-funnel");
  if (!res.ok) throw new Error(`leads_funnel_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = LeadsFunnelResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("leads_funnel_shape_mismatch");
  return parsed.data;
}

export function useLeadsFunnel() {
  return useQuery({
    queryKey: ["analytics", "leads-funnel"],
    queryFn: fetchLeadsFunnel,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
