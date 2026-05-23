"use client";

import { useQuery } from "@tanstack/react-query";
import { UnitsResponseSchema, type UnitsResponse } from "@/types/api";

export interface ProjectUnitsFilters {
  status?: string;
  floor?: number | string;
}

async function fetchProjectUnits(
  projectId: string,
  filters: ProjectUnitsFilters,
): Promise<UnitsResponse> {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.floor != null && filters.floor !== "")
    qs.set("floor", String(filters.floor));

  const queryString = qs.toString();
  const url = queryString
    ? `/api/projects/${encodeURIComponent(projectId)}/units?${queryString}`
    : `/api/projects/${encodeURIComponent(projectId)}/units`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`project_units_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = UnitsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("project_units_shape_mismatch");
  return parsed.data;
}

/**
 * Fetches units for a specific project with optional status and floor filters.
 * Used by the /projects/[projectId]/inventory page.
 */
export function useProjectUnits(
  projectId: string | null | undefined,
  filters: ProjectUnitsFilters = {},
) {
  return useQuery({
    queryKey: ["project-units", projectId, filters.status ?? null, filters.floor ?? null],
    queryFn: () => fetchProjectUnits(projectId as string, filters),
    enabled: Boolean(projectId),
    staleTime: 25_000,
  });
}
