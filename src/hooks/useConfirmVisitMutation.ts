import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ConfirmVisitVars {
  visitId: string;
  bookingId: string;
}

async function confirmVisit(vars: ConfirmVisitVars): Promise<void> {
  const res = await fetch(`/api/site-visits/${encodeURIComponent(vars.visitId)}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (res.status === 403) {
    throw new Error("You do not have permission to confirm visits.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to confirm visit";
    throw new Error(msg);
  }
}

export function useConfirmVisitMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, ConfirmVisitVars>({
    mutationFn: confirmVisit,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["site-visits", vars.bookingId] });
      void queryClient.invalidateQueries({ queryKey: ["site-visit", vars.visitId] });
      void queryClient.invalidateQueries({ queryKey: ["site-visit-history", vars.visitId] });
    },
  });
}
