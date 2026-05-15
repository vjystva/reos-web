"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LeadSchema, LeadsResponseSchema, type Lead } from "@/types/api";

async function fetchLead(id: string): Promise<Lead> {
  const res = await fetch(`/api/leads/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error(`lead_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = LeadSchema.safeParse(json);
  if (!parsed.success) throw new Error("lead_shape_mismatch");
  return parsed.data;
}

/**
 * Loads a single lead. Seeds initialData from any cached `leads` list query so
 * the slide-over can render instantly when the row was already in the table.
 */
export function useLead(id: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["lead", id],
    queryFn: () => fetchLead(id as string),
    enabled: Boolean(id),
    initialData: () => {
      if (!id) return undefined;
      const queries = qc.getQueriesData({ queryKey: ["leads"] });
      for (const [, value] of queries) {
        const parsed = LeadsResponseSchema.safeParse(value);
        if (parsed.success) {
          const hit = parsed.data.data.find((l) => l.id === id);
          if (hit) return hit;
        }
      }
      return undefined;
    },
  });
}
