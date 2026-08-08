import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RecordPaymentRequest, RecordPaymentResponse } from "@/types/api";

interface RecordPaymentVars {
  body: RecordPaymentRequest;
  scheduleId: string;
  bookingId: string;
}

async function recordPayment(vars: RecordPaymentVars): Promise<RecordPaymentResponse> {
  const res = await fetch("/api/payments", {
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
      "Failed to record payment";
    throw new Error(msg);
  }
  return res.json() as Promise<RecordPaymentResponse>;
}

export function useRecordPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation<RecordPaymentResponse, Error, RecordPaymentVars>({
    mutationFn: recordPayment,
    onSuccess: (_data, vars) => {
      // Invalidate milestones and payment history (no optimistic updates — financial data).
      void queryClient.invalidateQueries({
        queryKey: ["payment-milestones", vars.scheduleId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["payments", vars.bookingId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["payment-schedule", vars.bookingId],
      });
      // The booking's own status can move on the back of a payment, and the
      // list tiles aggregate collected amounts.
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}
