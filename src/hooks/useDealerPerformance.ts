import { useQuery } from "@tanstack/react-query";
import {
  DealerPerformanceResponseSchema,
  type DealerPerformance,
} from "@/types/api";

async function fetchDealerPerformance(
  dealerId: string,
): Promise<DealerPerformance> {
  const res = await fetch(
    `/api/dealers/${encodeURIComponent(dealerId)}/performance`,
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ??
        "Failed to fetch dealer performance",
    );
  }
  const json = await res.json();
  const parsed = DealerPerformanceResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("dealer_performance_shape_mismatch");
  }
  return parsed.data.performance;
}

/**
 * Fetch performance data for a single dealer.
 * Pass `null` / `undefined` to disable the query.
 */
export function useDealerPerformance(dealerId: string | null | undefined) {
  return useQuery<DealerPerformance, Error>({
    queryKey: ["dealers", "performance", dealerId],
    queryFn: () => fetchDealerPerformance(dealerId!),
    enabled: !!dealerId,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
