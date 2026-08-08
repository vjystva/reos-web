import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CompleteVisitVars {
  visitId: string;
  bookingId: string;
}

/**
 * `POST /api/site-visits/:id/complete` -> backend
 * `POST /site-visits/:id/complete`.
 *
 * Only `confirmed -> completed` is legal upstream, so the button that calls
 * this is only rendered for a confirmed visit; an out-of-order call still
 * answers 422 and the message is surfaced verbatim.
 */
async function completeVisit(vars: CompleteVisitVars): Promise<void> {
  const res = await fetch(
    `/api/site-visits/${encodeURIComponent(vars.visitId)}/complete`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (res.status === 403) {
    throw new Error("You do not have permission to complete visits.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to complete visit";
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg);
  }
}

export function useCompleteVisitMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, CompleteVisitVars>({
    mutationFn: completeVisit,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["site-visits", vars.bookingId] });
      void queryClient.invalidateQueries({ queryKey: ["site-visit", vars.visitId] });
      void queryClient.invalidateQueries({ queryKey: ["site-visit-history", vars.visitId] });
      void queryClient.invalidateQueries({ queryKey: ["site-visits", "calendar"] });
    },
  });
}
