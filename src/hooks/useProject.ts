"use client";

import { useQuery } from "@tanstack/react-query";
import { ProjectSchema, type Project } from "@/types/api";

async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error(`project_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = ProjectSchema.safeParse(json);
  if (!parsed.success) throw new Error("project_shape_mismatch");
  return parsed.data;
}

export function useProject(id: string | null | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id as string),
    enabled: Boolean(id),
    refetchInterval: false,
    staleTime: 60_000,
  });
}
