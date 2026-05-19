import { useMutation, useQueryClient } from "@tanstack/react-query";

async function triggerWorkflow(workflowId: string): Promise<unknown> {
  const res = await fetch(
    `/api/workflows/${encodeURIComponent(workflowId)}/trigger`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      "Failed to trigger workflow";
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}

export function useTriggerWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: triggerWorkflow,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflow-executions"] });
    },
  });
}
