"use client";
import { useQuery } from "@tanstack/react-query";
import { LeadSchema, type Lead } from "@/types/api";

async function fetchLead(id: string): Promise<Lead> {
  const res = await fetch(`/api/leads/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`lead_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = LeadSchema.safeParse(json);
  if (!parsed.success) throw new Error("lead_shape_mismatch");
  return parsed.data;
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ["leads", id],
    queryFn: () => fetchLead(id),
    staleTime: 25_000,
    enabled: !!id,
  });
}
