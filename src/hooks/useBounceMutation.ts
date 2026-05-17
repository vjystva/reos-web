import { useMutation, useQueryClient } from "@tanstack/react-query";

interface BounceVars {
  paymentId: string;
  scheduleId: string;
  bookingId: string;
}

async function bouncePayment(vars: BounceVars): Promise<void> {
  const res = await fetch(`/api/payments/${encodeURIComponent(vars.paymentId)}/bounce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (res.status === 403) {
    throw new Error("You do not have permission to perform this action.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to mark payment as bounced";
    throw new Error(msg);
  }
}

export function useBounceMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, BounceVars>({
    mutationFn: bouncePayment,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["payment-milestones", vars.scheduleId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["payments", vars.bookingId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["payment-schedule", vars.bookingId],
      });
    },
  });
}
