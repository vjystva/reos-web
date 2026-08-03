"use client";

import { useQuery } from "@tanstack/react-query";
import { CommissionsResponseSchema, type Commission } from "@/types/api";

export function formatCommissionStatus(status: string): string {
  const map: Record<string, string> = { pending: "Pending", approved: "Approved", paid: "Paid", cancelled: "Cancelled" };
  return map[status] ?? status;
}

export function commissionStatusClass(status: string): string {
  switch (status) {
    case "paid": return "bg-green-100 text-green-800";
    case "approved": return "bg-yellow-100 text-yellow-800";
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

export function totalByStatus(commissions: Commission[], status: string): number {
  return commissions
    .filter((c) => c.status === status)
    .reduce((s, c) => s + parseFloat(c.amount), 0);
}

async function fetchCommissions(dealerId?: string): Promise<Commission[]> {
  const qs = dealerId ? `?dealerId=${dealerId}` : "";
  const res = await fetch(`/api/commissions${qs}`);
  if (!res.ok) throw new Error(`commissions_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = CommissionsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("commissions_shape_mismatch");
  return parsed.data;
}

export function useCommissions(dealerId?: string) {
  return useQuery({
    queryKey: ["commissions", dealerId ?? "all"],
    queryFn: () => fetchCommissions(dealerId),
    staleTime: 25_000,
  });
}
