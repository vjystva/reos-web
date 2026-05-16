"use client";

import { useQuery } from "@tanstack/react-query";
import { LeadsResponseSchema, type LeadsResponse } from "@/types/api";

async function fetchLeadsForBooking(): Promise<LeadsResponse> {
  const res = await fetch("/api/leads?pageSize=50");
  if (!res.ok) throw new Error(`leads_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = LeadsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("leads_shape_mismatch");
  return parsed.data;
}

/**
 * Leads list for the booking-form combobox. Backend JWT auto-scopes to the
 * current user — no `assignedTo` param needed. The query key is intentionally
 * isolated from `useLeads(...)` so the 50-row payload does not pollute the
 * pipeline cache.
 */
export function useLeadsForBooking() {
  return useQuery({
    queryKey: ["leads", "forBooking", 50],
    queryFn: fetchLeadsForBooking,
    refetchInterval: false,
    staleTime: 60_000,
  });
}
