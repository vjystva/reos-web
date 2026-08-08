import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ScheduleVisitRequest } from "@/types/api";

interface ScheduleVisitVars {
  body: ScheduleVisitRequest;
  /** Only used to target cache invalidation — not sent upstream. */
  bookingId: string;
}

/**
 * `POST /api/site-visits` -> backend `POST /site-visits`
 * (`CreateSiteVisitDto`: leadId, assignedAgentId, scheduledAt required).
 *
 * Creating a visit also auto-advances a `new`/`contacted` lead to
 * `site_visit_scheduled` server-side, so the lead caches are invalidated too.
 */
async function scheduleVisit(vars: ScheduleVisitVars): Promise<void> {
  const res = await fetch("/api/site-visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vars.body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const raw =
      (err as { message?: string | string[]; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to schedule visit";
    throw new Error(Array.isArray(raw) ? raw.join(", ") : raw);
  }
}

export function useScheduleVisitMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, ScheduleVisitVars>({
    mutationFn: scheduleVisit,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["site-visits", vars.bookingId] });
      void queryClient.invalidateQueries({ queryKey: ["site-visits", "calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
