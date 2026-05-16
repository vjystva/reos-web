"use client";

import { useQuery } from "@tanstack/react-query";
import { ProjectsResponseSchema, type ProjectsResponse } from "@/types/api";

export interface UseProjectsParams {
  search?: string;
  page?: string | number;
  pageSize?: string | number;
}

function buildQs(params: UseProjectsParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

async function fetchProjects(qs: string): Promise<ProjectsResponse> {
  const url = qs ? `/api/projects?${qs}` : "/api/projects";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`projects_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = ProjectsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("projects_shape_mismatch");
  return parsed.data;
}

/**
 * Projects list — paginated, search-filtered. No polling: projects rarely
 * change minute-to-minute and the list is navigational.
 */
export function useProjects(params: UseProjectsParams = {}) {
  const qs = buildQs(params);
  return useQuery({
    queryKey: ["projects", qs],
    queryFn: () => fetchProjects(qs),
    refetchInterval: false,
    staleTime: 60_000,
  });
}
