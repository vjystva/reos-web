import { useMutation, useQueryClient } from "@tanstack/react-query";

async function deleteWorkflow(workflowId: string): Promise<{ ok: true }> {
  const res = await fetch(
    `/api/workflows/${encodeURIComponent(workflowId)}`,
    { method: "DELETE" },
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
      "Failed to delete workflow";
    throw new Error(msg);
  }
  return { ok: true };
}

export function useDeleteWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: true }, Error, string>({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}
