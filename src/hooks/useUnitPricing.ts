"use client";

import { useQuery } from "@tanstack/react-query";
import { PricePredictionResponseSchema, type PricePredictionResponse } from "@/types/api";

export class UnitPricingNotFoundError extends Error {
  constructor() {
    super("unit_pricing_not_found");
    this.name = "UnitPricingNotFoundError";
  }
}

async function fetchUnitPricing(unitId: string): Promise<PricePredictionResponse> {
  const res = await fetch(`/api/pricing/${encodeURIComponent(unitId)}`);
  if (res.status === 404) throw new UnitPricingNotFoundError();
  if (!res.ok) throw new Error(`unit_pricing_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = PricePredictionResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("unit_pricing_shape_mismatch");
  return parsed.data;
}

/**
 * Fetches AI-predicted pricing for a unit via the BFF proxy at
 * GET /api/pricing/:unitId. Caches for 25 seconds per project spec.
 */
export function useUnitPricing(unitId: string | null | undefined) {
  return useQuery({
    queryKey: ["unitPricing", unitId],
    queryFn: () => fetchUnitPricing(unitId as string),
    enabled: Boolean(unitId),
    staleTime: 25_000,
    retry: false,
  });
}
