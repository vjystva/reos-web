"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LeadsBySourceResponseSchema,
  type LeadsBySourceResponse,
} from "@/types/api";

export interface DateRange {
  from: string;
  to: string;
}

async function fetchLeadsBySource(
  dateRange?: DateRange,
): Promise<LeadsBySourceResponse> {
  let url = "/api/analytics/leads-by-source";
  if (dateRange) {
    const qs = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
    url = `${url}?${qs.toString()}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`leads_by_source_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = LeadsBySourceResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("leads_by_source_shape_mismatch");
  return parsed.data;
}

export function useLeadsBySource(dateRange?: DateRange) {
  return useQuery({
    queryKey: ["analytics", "leads-by-source", dateRange ?? null],
    queryFn: () => fetchLeadsBySource(dateRange),
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
