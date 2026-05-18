import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateDealerRequest } from "@/types/api";

interface UpdateDealerVars {
  dealerId: string;
  body: UpdateDealerRequest;
}

async function updateDealer(vars: UpdateDealerVars): Promise<void> {
  const res = await fetch(
    `/api/dealers/${encodeURIComponent(vars.dealerId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vars.body),
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
      "Failed to update dealer";
    throw new Error(msg);
  }
}

export function useUpdateDealerMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, UpdateDealerVars>({
    mutationFn: updateDealer,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["dealers"] });
      void queryClient.invalidateQueries({
        queryKey: ["dealers", vars.dealerId],
      });
    },
  });
}
