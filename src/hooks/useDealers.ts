import { useQuery } from "@tanstack/react-query";
import type { DealerStatus, DealersResponse } from "@/types/api";

/**
 * Query params accepted by `GET /dealers` (backend `QueryDealersDto`):
 * `status`, `page`, `limit` — and nothing else. The backend runs a global
 * ValidationPipe with `forbidNonWhitelisted: true`, so any extra param 400s
 * the whole request. In particular there is no `region` column on `dealers`,
 * and activity is modelled by `status` ('active' | 'inactive' | 'suspended'),
 * not a boolean `isActive`.
 */
export interface UseDealersArgs {
  status?: DealerStatus;
  page?: number;
  limit?: number;
}

function buildQuery(args: UseDealersArgs): string {
  const qs = new URLSearchParams();
  if (args.status) qs.set("status", args.status);
  if (args.page != null) qs.set("page", String(args.page));
  if (args.limit != null) qs.set("limit", String(args.limit));
  return qs.toString();
}

async function fetchDealers(args: UseDealersArgs): Promise<DealersResponse> {
  const query = buildQuery(args);
  const url = query ? `/api/dealers?${query}` : "/api/dealers";
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
  const key = buildQuery(args);
  return useQuery<DealersResponse, Error>({
    queryKey: ["dealers", key],
    queryFn: () => fetchDealers(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
