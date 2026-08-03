"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TransitionUnitStatusRequest, Unit } from "@/types/api";

async function updateUnitStatus(
  projectId: string,
  unitId: string,
  body: TransitionUnitStatusRequest,
): Promise<Unit> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/units/${encodeURIComponent(
      unitId,
    )}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to update unit status";
    throw new Error(msg);
  }
  return res.json() as Promise<Unit>;
}

/**
 * Transition a unit's status. Invalidates every `["units", projectId, ...]`
 * query on success so the grid + slide-over badge reflect the new status
 * without a manual refresh.
 */
export function useUpdateUnitStatusMutation(projectId: string, unitId: string) {
  const qc = useQueryClient();
  return useMutation<Unit, Error, TransitionUnitStatusRequest>({
    mutationFn: (body) => updateUnitStatus(projectId, unitId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["units", projectId] });
    },
  });
}
