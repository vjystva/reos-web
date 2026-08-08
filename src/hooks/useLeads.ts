"use client";

import { useQuery } from "@tanstack/react-query";
import { LeadsResponseSchema, type LeadsResponse } from "@/types/api";

export interface UseLeadsParams {
  stage?: string;
  temperature?: string;
  assignedDealerId?: string;
  q?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: string | number;
  pageSize?: string | number;
}

/**
 * UI sort key -> backend `ListLeadsDto.sortBy` value.
 *
 * The backend whitelists exactly four snake_case columns
 * (`created_at | updated_at | ai_score | assigned_at | first_name`) and
 * answers 400 for anything else. The table headers emit camelCase UI keys
 * (`name` / `aiScore` / `createdAt`), so every single column-header click
 * used to blank the pipeline with "Failed to load leads."
 *
 * An unmapped key is DROPPED rather than forwarded — a stale/bookmarked
 * `?sort=whatever` degrades to the default ordering instead of erroring.
 */
const SORT_FIELD_MAP: Record<string, string> = {
  name: "first_name",
  firstName: "first_name",
  first_name: "first_name",
  aiScore: "ai_score",
  ai_score: "ai_score",
  createdAt: "created_at",
  created_at: "created_at",
  updatedAt: "updated_at",
  updated_at: "updated_at",
  assignedAt: "assigned_at",
  assigned_at: "assigned_at",
};

export function toBackendSortField(key: string | undefined): string | null {
  if (!key) return null;
  return SORT_FIELD_MAP[key] ?? null;
}

function buildQs(params: UseLeadsParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (k === "sortBy") {
      const mapped = toBackendSortField(String(v));
      if (mapped) qs.set("sortBy", mapped);
      continue;
    }
    if (k === "sortOrder") {
      const order = String(v).toLowerCase();
      if (order === "asc" || order === "desc") qs.set("sortOrder", order);
      continue;
    }
    qs.set(k, String(v));
  }
  // `sortOrder` without `sortBy` is meaningless upstream; drop the orphan.
  if (qs.has("sortOrder") && !qs.has("sortBy")) qs.delete("sortOrder");
  return qs.toString();
}

async function fetchLeads(qs: string): Promise<LeadsResponse> {
  const url = qs ? `/api/leads?${qs}` : "/api/leads";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`leads_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = LeadsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("leads_shape_mismatch");
  return parsed.data;
}

export function useLeads(params: UseLeadsParams = {}) {
  const qs = buildQs(params);
  return useQuery({
    queryKey: ["leads", qs],
    queryFn: () => fetchLeads(qs),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  });
}
