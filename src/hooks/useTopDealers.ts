"use client";

import { useQuery } from "@tanstack/react-query";
import {
  TopDealersResponseSchema,
  type TopDealersResponse,
} from "@/types/api";

async function fetchTopDealers(): Promise<TopDealersResponse> {
  const res = await fetch("/api/analytics/top-dealers");
  if (!res.ok) throw new Error(`top_dealers_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = TopDealersResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("top_dealers_shape_mismatch");
  return parsed.data;
}

export function useTopDealers() {
  return useQuery({
    queryKey: ["analytics", "top-dealers"],
    queryFn: fetchTopDealers,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
