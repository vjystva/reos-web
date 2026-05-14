"use client";

import { useQuery } from "@tanstack/react-query";
import { MetricsResponseSchema, type MetricsResponse } from "@/types/api";

async function fetchMetrics(): Promise<MetricsResponse> {
  const res = await fetch("/api/metrics");
  if (!res.ok) throw new Error(`metrics_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = MetricsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("metrics_shape_mismatch");
  return parsed.data;
}

export function useMetrics() {
  const q = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  });
  return {
    ...q,
    failedSlots: q.data?.failed ?? [],
  };
}
