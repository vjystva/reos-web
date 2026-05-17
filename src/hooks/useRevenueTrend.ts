"use client";

import { useQuery } from "@tanstack/react-query";
import {
  RevenueTrendResponseSchema,
  type RevenueTrendResponse,
} from "@/types/api";

async function fetchRevenueTrend(): Promise<RevenueTrendResponse> {
  const res = await fetch("/api/analytics/revenue-trend");
  if (!res.ok) throw new Error(`revenue_trend_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = RevenueTrendResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("revenue_trend_shape_mismatch");
  return parsed.data;
}

export function useRevenueTrend() {
  return useQuery({
    queryKey: ["analytics", "revenue-trend"],
    queryFn: fetchRevenueTrend,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
