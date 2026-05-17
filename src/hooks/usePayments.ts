import { useQuery } from "@tanstack/react-query";
import type { PaymentsResponse } from "@/types/api";

async function fetchPayments(bookingId: string): Promise<PaymentsResponse> {
  const res = await fetch(`/api/payments?bookingId=${encodeURIComponent(bookingId)}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch payments");
  }
  return res.json() as Promise<PaymentsResponse>;
}

export function usePayments(bookingId: string | null) {
  return useQuery<PaymentsResponse, Error>({
    queryKey: ["payments", bookingId],
    queryFn: () => fetchPayments(bookingId!),
    enabled: !!bookingId,
    staleTime: 30_000,
    retry: 1,
  });
}
