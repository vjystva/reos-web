import { useQuery } from "@tanstack/react-query";
import {
  DealersPerformanceResponseSchema,
  type DealerPerformance,
} from "@/types/api";

export interface UseDealersPerformanceArgs {
  sortBy?: "leadCount" | "bookingCount" | "conversionRate" | "revenue";
  order?: "asc" | "desc";
}

async function fetchDealersPerformance(
  args: UseDealersPerformanceArgs,
): Promise<DealerPerformance[]> {
  const qs = new URLSearchParams();
  if (args.sortBy) qs.set("sortBy", args.sortBy);
  if (args.order) qs.set("order", args.order);

  const url = qs.toString()
    ? `/api/dealers/performance?${qs.toString()}`
    : "/api/dealers/performance";

  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ??
        "Failed to fetch dealers performance",
    );
  }
  const json = await res.json();
  const parsed = DealersPerformanceResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("dealers_performance_shape_mismatch");
  }
  return parsed.data.performance;
}

/**
 * Fetch performance list for all dealers, optionally sorted.
 */
export function useDealersPerformance(
  args: UseDealersPerformanceArgs = {},
) {
  const key = JSON.stringify(args);
  return useQuery<DealerPerformance[], Error>({
    queryKey: ["dealers", "performance", "list", key],
    queryFn: () => fetchDealersPerformance(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
