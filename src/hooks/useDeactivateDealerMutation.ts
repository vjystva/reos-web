import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DeactivateDealerVars {
  dealerId: string;
}

async function deactivateDealer(vars: DeactivateDealerVars): Promise<void> {
  const res = await fetch(
    `/api/dealers/${encodeURIComponent(vars.dealerId)}`,
    { method: "DELETE" },
  );
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
