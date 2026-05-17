"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AnalyticsOverviewSchema,
  type AnalyticsOverview,
} from "@/types/api";

async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const res = await fetch("/api/analytics/overview");
  if (!res.ok) throw new Error(`analytics_overview_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = AnalyticsOverviewSchema.safeParse(json);
  if (!parsed.success) throw new Error("analytics_overview_shape_mismatch");
  return parsed.data;
}

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: fetchAnalyticsOverview,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
