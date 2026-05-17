import { useQuery } from "@tanstack/react-query";
import type { SiteVisit } from "@/types/api";

async function fetchSiteVisit(visitId: string): Promise<SiteVisit> {
  const res = await fetch(`/api/site-visits/${encodeURIComponent(visitId)}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch site visit");
  }
  return res.json() as Promise<SiteVisit>;
}

export function useSiteVisit(visitId: string | null) {
  return useQuery<SiteVisit, Error>({
    queryKey: ["site-visit", visitId],
    queryFn: () => fetchSiteVisit(visitId!),
    enabled: !!visitId,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
