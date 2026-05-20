"use client";

import { useQuery } from "@tanstack/react-query";
import {
  PaymentsByMonthResponseSchema,
  type PaymentsByMonthResponse,
} from "@/types/api";

async function fetchPaymentsByMonth(
  year: number,
): Promise<PaymentsByMonthResponse> {
  const res = await fetch(
    `/api/analytics/payments-by-month?year=${encodeURIComponent(year)}`,
  );
  if (!res.ok) throw new Error(`payments_by_month_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = PaymentsByMonthResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("payments_by_month_shape_mismatch");
  return parsed.data;
}

export function usePaymentsByMonth(year: number) {
  return useQuery({
    queryKey: ["analytics", "payments-by-month", year],
    queryFn: () => fetchPaymentsByMonth(year),
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
