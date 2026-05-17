import { useQuery } from "@tanstack/react-query";
import type { SiteVisitStatus, SiteVisitsResponse } from "@/types/api";

interface UseSiteVisitsArgs {
  bookingId: string | null;
  status?: SiteVisitStatus;
  page?: number;
  limit?: number;
}

async function fetchSiteVisits(args: UseSiteVisitsArgs): Promise<SiteVisitsResponse> {
  const qs = new URLSearchParams();
  qs.set("bookingId", args.bookingId!);
  if (args.status) qs.set("status", args.status);
  if (args.page != null) qs.set("page", String(args.page));
  if (args.limit != null) qs.set("limit", String(args.limit));

  const res = await fetch(`/api/site-visits?${qs.toString()}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch site visits");
  }
  return res.json() as Promise<SiteVisitsResponse>;
}

export function useSiteVisits(args: UseSiteVisitsArgs) {
  return useQuery<SiteVisitsResponse, Error>({
    queryKey: ["site-visits", args.bookingId, args.status ?? null, args.page ?? null, args.limit ?? null],
    queryFn: () => fetchSiteVisits(args),
    enabled: !!args.bookingId,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
