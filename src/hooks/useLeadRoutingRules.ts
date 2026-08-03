"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LeadRoutingRulesResponseSchema,
  type LeadRoutingRulesResponse,
} from "@/types/api";

export interface UseLeadRoutingRulesArgs {
  isActive?: boolean;
}

async function fetchLeadRoutingRules(
  args: UseLeadRoutingRulesArgs,
): Promise<LeadRoutingRulesResponse> {
  const qs = new URLSearchParams();
  if (args.isActive !== undefined) qs.set("isActive", String(args.isActive));

  const url = qs.toString()
    ? `/api/lead-routing-rules?${qs.toString()}`
    : "/api/lead-routing-rules";
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(err.message ?? err.error ?? "Failed to fetch routing rules");
  }
  const parsed = LeadRoutingRulesResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("lead_routing_rules_shape_mismatch");
  return parsed.data;
}

/**
 * Ordered routing rules (priority ASC — first match wins). Settings data, so
 * no polling: it only changes when this page saves.
 */
export function useLeadRoutingRules(args: UseLeadRoutingRulesArgs = {}) {
  return useQuery<LeadRoutingRulesResponse, Error>({
    queryKey: ["lead-routing-rules", args.isActive ?? null],
    queryFn: () => fetchLeadRoutingRules(args),
    staleTime: 60_000,
    refetchInterval: false,
    retry: 1,
  });
}
