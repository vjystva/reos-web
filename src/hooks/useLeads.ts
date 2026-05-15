"use client";

import { useQuery } from "@tanstack/react-query";
import { LeadsResponseSchema, type LeadsResponse } from "@/types/api";

export interface UseLeadsParams {
  stage?: string;
  temperature?: string;
  dealer?: string;
  search?: string;
  sort?: string;
  order?: string;
  page?: string | number;
  pageSize?: string | number;
}

function buildQs(params: UseLeadsParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") qs.set(k, String(v));
  }
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
