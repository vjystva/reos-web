"use client";

import { useQuery } from "@tanstack/react-query";
import { UnitsResponseSchema, type UnitsResponse } from "@/types/api";

export interface UseUnitsParams {
  towerId?: string | null;
  status?: string;
  bedrooms?: string | number;
  floorMin?: string | number;
  floorMax?: string | number;
  priceMin?: string | number;
  priceMax?: string | number;
  sortBy?: string;
  page?: string | number;
  pageSize?: string | number;
}

function buildQs(params: UseUnitsParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

async function fetchUnits(
  projectId: string,
  qs: string,
): Promise<UnitsResponse> {
  const url = qs
    ? `/api/projects/${encodeURIComponent(projectId)}/units?${qs}`
    : `/api/projects/${encodeURIComponent(projectId)}/units`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`units_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = UnitsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("units_shape_mismatch");
  return parsed.data;
}

/**
 * Units grid — polls every 30s to keep availability fresh against competing
 * agents. Background-tab polling suppressed (queryClient default).
 */
export function useUnits(
  projectId: string | null | undefined,
  params: UseUnitsParams = {},
) {
  const qs = buildQs(params);
  return useQuery({
    queryKey: ["units", projectId, params.towerId ?? null, qs],
    queryFn: () => fetchUnits(projectId as string, qs),
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  });
}
