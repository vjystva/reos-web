import { useQuery } from "@tanstack/react-query";
import type { MilestonesResponse, Milestone, MilestoneStatus } from "@/types/api";

export type MilestoneWithDerivedStatus = Milestone & { derivedStatus: MilestoneStatus };

/**
 * Computes derivedStatus from server data with a client-side fallback
 * (Feasibility R2 / Architecture D3):
 *
 *  - server `overdue: true`         → 'overdue'
 *  - amountPaid >= dueAmount        → 'paid'
 *  - dueDate < today AND !overdue   → 'overdue' (fallback if server omits flag)
 *  - otherwise                      → 'pending'
 *
 * Server-supplied `status` field takes precedence over the computed value when
 * it is one of the known enum values.
 */
function deriveMilestoneStatus(m: Milestone): MilestoneStatus {
  if (m.status === "paid" || m.amountPaid >= m.dueAmount) return "paid";
  if (m.overdue === true || m.status === "overdue") return "overdue";
  if (!m.dueDate) return "pending";
  // Client-side overdue fallback: dueDate has passed.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(m.dueDate);
  if (due < today && m.amountPaid < m.dueAmount) return "overdue";
  return "pending";
}

async function fetchMilestones(scheduleId: string): Promise<MilestonesResponse> {
  const res = await fetch(
    `/api/payment-schedules/${encodeURIComponent(scheduleId)}/milestones`,
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch milestones");
  }
  return res.json() as Promise<MilestonesResponse>;
}

export function usePaymentMilestones(scheduleId: string | null) {
  return useQuery<MilestonesResponse, Error, MilestoneWithDerivedStatus[]>({
    queryKey: ["payment-milestones", scheduleId],
    queryFn: () => fetchMilestones(scheduleId!),
    enabled: !!scheduleId,
    staleTime: 30_000,
    retry: 1,
    select: (data) =>
      data.data.map((m) => ({ ...m, derivedStatus: deriveMilestoneStatus(m) })),
  });
}
