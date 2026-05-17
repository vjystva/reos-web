import { useQuery } from "@tanstack/react-query";
import type { SiteVisitHistory } from "@/types/api";

interface SiteVisitHistoryResponse {
  data: SiteVisitHistory[];
  total: number;
}

async function fetchHistory(visitId: string): Promise<SiteVisitHistoryResponse> {
  const res = await fetch(`/api/site-visits/${encodeURIComponent(visitId)}/history`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch history");
  }
  return res.json() as Promise<SiteVisitHistoryResponse>;
}

export function useSiteVisitHistory(visitId: string | null) {
  return useQuery<SiteVisitHistoryResponse, Error>({
    queryKey: ["site-visit-history", visitId],
    queryFn: () => fetchHistory(visitId!),
    enabled: !!visitId,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
