import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateDealerRequest } from "@/types/api";

interface DeactivateDealerVars {
  dealerId: string;
}

/**
 * Deactivation is a status transition, not a delete.
 *
 * The backend has no `DELETE /dealers/:id` — the only DELETE under the dealers
 * controller is `DELETE /dealers/:id/projects/:projectId` (unassign a project).
 * Deactivating goes through `PATCH /dealers/:id` with `{ status: 'inactive' }`,
 * which is exactly what `useUpdateDealerMutation` does; this hook is the named,
 * intention-revealing wrapper around that one call.
 */
const DEACTIVATE_BODY: UpdateDealerRequest = { status: "inactive" };

async function deactivateDealer(vars: DeactivateDealerVars): Promise<void> {
  const res = await fetch(`/api/dealers/${encodeURIComponent(vars.dealerId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(DEACTIVATE_BODY),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (res.status === 403) {
    throw new Error("You do not have permission to deactivate this dealer.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to deactivate dealer";
    throw new Error(msg);
  }
}

export function useDeactivateDealerMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, DeactivateDealerVars>({
    mutationFn: deactivateDealer,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["dealers"] });
      void queryClient.invalidateQueries({
        queryKey: ["dealers", vars.dealerId],
      });
    },
  });
}
