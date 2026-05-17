import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RescheduleVisitRequest } from "@/types/api";

interface RescheduleVisitVars {
  visitId: string;
  bookingId: string;
  body: RescheduleVisitRequest;
}

async function rescheduleVisit(vars: RescheduleVisitVars): Promise<void> {
  const res = await fetch(`/api/site-visits/${encodeURIComponent(vars.visitId)}/reschedule`, {
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
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to reschedule visit";
    throw new Error(msg);
  }
}

export function useRescheduleVisitMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, RescheduleVisitVars>({
    mutationFn: rescheduleVisit,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["site-visits", vars.bookingId] });
      void queryClient.invalidateQueries({ queryKey: ["site-visit", vars.visitId] });
      void queryClient.invalidateQueries({ queryKey: ["site-visit-history", vars.visitId] });
    },
  });
}
