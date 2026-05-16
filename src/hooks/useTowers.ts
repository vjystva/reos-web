"use client";

import { useQuery } from "@tanstack/react-query";
import { TowersResponseSchema, type TowersResponse } from "@/types/api";

async function fetchTowers(projectId: string): Promise<TowersResponse> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/towers`,
  );
  if (!res.ok) throw new Error(`towers_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = TowersResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("towers_shape_mismatch");
  return parsed.data;
}

export function useTowers(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["towers", projectId],
    queryFn: () => fetchTowers(projectId as string),
    enabled: Boolean(projectId),
    refetchInterval: false,
    staleTime: 60_000,
  });
}
