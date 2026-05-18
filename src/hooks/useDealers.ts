import { useQuery } from "@tanstack/react-query";
import type { DealersResponse } from "@/types/api";

export interface UseDealersArgs {
  isActive?: boolean;
  region?: string;
}

async function fetchDealers(args: UseDealersArgs): Promise<DealersResponse> {
  const qs = new URLSearchParams();
  if (args.isActive !== undefined) qs.set("isActive", String(args.isActive));
  if (args.region) qs.set("region", args.region);

  const url = qs.toString() ? `/api/dealers?${qs.toString()}` : "/api/dealers";
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch dealers",
    );
  }
  return res.json() as Promise<DealersResponse>;
}

export function useDealers(args: UseDealersArgs = {}) {
  const qs = new URLSearchParams();
  if (args.isActive !== undefined) qs.set("isActive", String(args.isActive));
  if (args.region) qs.set("region", args.region);
  const key = qs.toString();
  return useQuery<DealersResponse, Error>({
    queryKey: ["dealers", key],
    queryFn: () => fetchDealers(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
