"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LeadsResponseSchema, type Lead } from "@/types/api";

export const PIPELINE_STATUSES = [
  "New",
  "Contacted",
  "Site Visit",
  "Negotiation",
  "Converted",
  "Lost",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

/**
 * Maps backend lead stage values to the 6 display columns shown in the
 * pipeline board.  Any stage not listed here falls through as its own key
 * (unknown statuses go into their own column, not Lost).
 */
export function normaliseStatus(stage: string): string {
  const map: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    site_visit_scheduled: "Site Visit",
    site_visit_done: "Site Visit",
    negotiation: "Negotiation",
    booking: "Converted",
    converted: "Converted",
    lost: "Lost",
  };
  return map[stage] ?? stage;
}

async function fetchAllLeads(): Promise<Lead[]> {
  const res = await fetch("/api/leads?pageSize=500");
  if (!res.ok) throw new Error(`leads_fetch_failed_${res.status}`);
  const json: unknown = await res.json();
  const parsed = LeadsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("leads_shape_mismatch");
  return parsed.data.data;
}

export function groupByStatus(leads: Lead[]): Record<string, Lead[]> {
  // Initialise all 6 canonical columns so empty columns are always present
  const columns: Record<string, Lead[]> = {};
  for (const col of PIPELINE_STATUSES) {
    columns[col] = [];
  }

  for (const lead of leads) {
    const col = normaliseStatus(lead.stage);
    if (!columns[col]) {
      // Unknown status: create its own column rather than lumping into Lost
      columns[col] = [];
    }
    columns[col].push(lead);
  }

  return columns;
}

export function useLeadPipeline() {
  const query = useQuery({
    queryKey: ["leads", "pipeline"],
    queryFn: fetchAllLeads,
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const columns = query.data ? groupByStatus(query.data) : (() => {
    const empty: Record<string, Lead[]> = {};
    for (const col of PIPELINE_STATUSES) {
      empty[col] = [];
    }
    return empty;
  })();

  return {
    columns,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

async function updateLeadStatus(id: string, status: string): Promise<void> {
  const res = await fetch(`/api/leads/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`update_lead_status_failed_${res.status}`);
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateLeadStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
