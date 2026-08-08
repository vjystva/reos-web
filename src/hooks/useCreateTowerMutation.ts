"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTowerRequest, Tower } from "@/types/api";

async function createTower(
  projectId: string,
  body: CreateTowerRequest,
): Promise<Tower> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/towers`,
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
      "Failed to create tower";
    throw new Error(msg);
  }
  return res.json() as Promise<Tower>;
}

/**
 * Create a tower under a project.
 *
 * On success it invalidates `["towers", projectId]` — the exact key
 * `useTowers` registers. That single invalidation is what makes the "Add
 * unit" form's Tower <select> repopulate without a page reload: the form
 * calls `useTowers(projectId)` itself, so it re-renders with the new tower
 * as soon as the refetch lands.
 *
 * `["units", projectId]` is deliberately NOT invalidated — a brand-new tower
 * has no units, and the units query is gated on `?tower` anyway.
 */
export function useCreateTowerMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation<Tower, Error, CreateTowerRequest>({
    mutationFn: (body) => createTower(projectId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["towers", projectId] });
    },
  });
}
