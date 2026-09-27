"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CollectionsAgingResponseSchema,
  type CollectionsAgingResponse,
} from "@/types/api";

async function fetchCollectionsAging(
  limit?: number,
): Promise<CollectionsAgingResponse> {
  const qs = limit != null ? `?limit=${limit}` : "";
  const res = await fetch(`/api/analytics/collections-aging${qs}`);
  if (!res.ok) throw new Error(`collections_aging_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = CollectionsAgingResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("collections_aging_shape_mismatch");
  return parsed.data;
}

/**
 * Outstanding receivables bucketed by days overdue.
 *
 * `limit` caps the detail list only; `totalCount` / `totalOutstanding` in the
 * response always cover every overdue milestone, so the header figures stay
 * correct even when the table is truncated.
 *
 * Same 5-minute cadence as useRevenueTrend — aging moves on a daily boundary,
 * so there is nothing to gain from polling harder.
 */
export function useCollectionsAging(limit?: number) {
  return useQuery({
    queryKey: ["analytics", "collections-aging", limit ?? null],
    queryFn: () => fetchCollectionsAging(limit),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
