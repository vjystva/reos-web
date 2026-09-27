"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BulkResult, BulkUnitStatusRequest } from "@/types/api";

async function bulkUpdateUnitStatus(
  body: BulkUnitStatusRequest,
): Promise<BulkResult> {
  const res = await fetch("/api/bulk/units/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
      "Failed to update unit statuses";
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg);
  }
  return res.json() as Promise<BulkResult>;
}

/**
 * Bulk unit status change — `POST /bulk/units/status`.
 *
 * IMPORTANT: this resolves (does not reject) on partial failure. The endpoint
 * answers 200 with `failed > 0` and a per-item `error` when some units could
 * not move (not found, disallowed transition, already in the target status,
 * missing note). Callers must inspect `result.failed` / `result.results` and
 * surface those reasons; only transport/envelope errors reject.
 *
 * Invalidates every `["units", projectId, ...]` query on settle — partial-match
 * key, so all towerId/filter variants of the inventory grid refetch. Invalidated
 * even when nothing succeeded, because the row statuses the user was looking at
 * may be stale (that is often *why* an item failed).
 */
export function useBulkUpdateUnitStatusMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation<BulkResult, Error, BulkUnitStatusRequest>({
    mutationFn: (body) => bulkUpdateUnitStatus(body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["units", projectId] });
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
