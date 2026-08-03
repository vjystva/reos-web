"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Commission, CommissionStatus } from "@/types/api";

export interface UpdateCommissionStatusVars {
  commissionId: string;
  status: CommissionStatus;
  /** Optional audit note. Omitted keeps whatever note is already on the row. */
  notes?: string;
}

async function updateCommissionStatus(
  vars: UpdateCommissionStatusVars,
): Promise<Commission> {
  const res = await fetch(
    `/api/commissions/${encodeURIComponent(vars.commissionId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        vars.notes ? { status: vars.status, notes: vars.notes } : { status: vars.status },
      ),
    },
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (res.status === 403) {
    throw new Error("You do not have permission to change commission status.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to update commission status";
    throw new Error(msg);
  }
  return res.json() as Promise<Commission>;
}

/**
 * `PATCH /commissions/:id/status` — pending → approved → paid (or cancelled).
 * Invalidates every `["commissions", …]` query so the dealer ledger, the
 * partner roster payout totals and the reports panel all refresh together.
 */
export function useUpdateCommissionStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation<Commission, Error, UpdateCommissionStatusVars>({
    mutationFn: updateCommissionStatus,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["commissions"] });
    },
  });
}
