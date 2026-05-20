"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ConversionFunnelSchema,
  type ConversionFunnel,
} from "@/types/api";

async function fetchConversionFunnel(): Promise<ConversionFunnel> {
  const res = await fetch("/api/analytics/conversion-funnel");
  if (!res.ok) throw new Error(`conversion_funnel_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = ConversionFunnelSchema.safeParse(json);
  if (!parsed.success) throw new Error("conversion_funnel_shape_mismatch");
  return parsed.data;
}

export function useConversionFunnel() {
  return useQuery({
    queryKey: ["analytics", "conversion-funnel"],
    queryFn: fetchConversionFunnel,
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
