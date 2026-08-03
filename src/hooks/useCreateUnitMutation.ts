"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateUnitRequest, Unit } from "@/types/api";

async function createUnit(
  projectId: string,
  body: CreateUnitRequest,
): Promise<Unit> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/units`,
    {
      method: "POST",
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
      "Failed to create unit";
    throw new Error(msg);
  }
  return res.json() as Promise<Unit>;
}

/**
 * Create a unit under a project. On success, invalidates every `["units",
 * projectId, ...]` query — the partial key match covers all towerId/qs
 * variants the units grid uses, so the new unit shows without a manual refresh.
 */
export function useCreateUnitMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation<Unit, Error, CreateUnitRequest>({
    mutationFn: (body) => createUnit(projectId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["units", projectId] });
    },
  });
}
