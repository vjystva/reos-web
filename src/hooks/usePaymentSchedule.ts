import { useQuery } from "@tanstack/react-query";
import type { PaymentSchedulesResponse } from "@/types/api";

async function fetchPaymentSchedule(bookingId: string): Promise<PaymentSchedulesResponse> {
  const res = await fetch(`/api/payment-schedules?bookingId=${encodeURIComponent(bookingId)}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch payment schedule");
  }
  return res.json() as Promise<PaymentSchedulesResponse>;
}

export function usePaymentSchedule(bookingId: string | null) {
  return useQuery<PaymentSchedulesResponse, Error>({
    queryKey: ["payment-schedule", bookingId],
    queryFn: () => fetchPaymentSchedule(bookingId!),
    enabled: !!bookingId,
    staleTime: 30_000,
    retry: 1,
  });
}
