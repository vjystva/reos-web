"use client";

import { useQuery } from "@tanstack/react-query";
import { UnitPriceConfigSchema, type UnitPriceConfig } from "@/types/api";

export class PriceConfigNotFoundError extends Error {
  constructor() {
    super("price_config_not_found");
    this.name = "PriceConfigNotFoundError";
  }
}

async function fetchPriceConfig(unitId: string): Promise<UnitPriceConfig> {
  const res = await fetch(
    `/api/units/${encodeURIComponent(unitId)}/price-config`,
  );
  if (res.status === 404) throw new PriceConfigNotFoundError();
  if (!res.ok) throw new Error(`price_config_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = UnitPriceConfigSchema.safeParse(json);
  if (!parsed.success) throw new Error("price_config_shape_mismatch");
  return parsed.data;
}

/**
 * Price config is session-immutable from the user's perspective, so cache for
 * 5 minutes. `enabled: !!unitId` ensures we only fetch when the slide-over
 * is open (i.e. the user clicked a unit).
 */
export function useUnitPriceConfig(unitId: string | null | undefined) {
  return useQuery({
    queryKey: ["priceConfig", unitId],
    queryFn: () => fetchPriceConfig(unitId as string),
    enabled: Boolean(unitId),
    refetchInterval: false,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
