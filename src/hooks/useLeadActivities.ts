"use client";
import { useQuery } from "@tanstack/react-query";
import {
  LeadActivitiesResponseSchema,
  type LeadActivitiesResponse,
} from "@/types/api";

async function fetchLeadActivities(
  id: string,
): Promise<LeadActivitiesResponse> {
  const res = await fetch(
    `/api/leads/${encodeURIComponent(id)}/activities`,
  );
  if (!res.ok) throw new Error(`lead_activities_fetch_failed_${res.status}`);
  const json: unknown = await res.json();
  const parsed = LeadActivitiesResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("lead_activities_shape_mismatch");
  return parsed.data;
}

/**
 * Lead engagement timeline. `GET /leads/:id` does NOT embed activities — the
 * `LeadResponseDto` carries no `activity` array — so the timeline has to come
 * from its own endpoint.
 */
export function useLeadActivities(id: string | null) {
  return useQuery({
    queryKey: ["leadActivities", id],
    queryFn: () => fetchLeadActivities(id as string),
    staleTime: 25_000,
    enabled: !!id,
  });
}
