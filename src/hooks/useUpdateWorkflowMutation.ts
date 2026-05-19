import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateWorkflowRequest, Workflow } from "@/types/api";

interface UpdateWorkflowVars {
  workflowId: string;
  body: UpdateWorkflowRequest;
}

async function updateWorkflow(vars: UpdateWorkflowVars): Promise<Workflow> {
  const res = await fetch(
    `/api/workflows/${encodeURIComponent(vars.workflowId)}`,
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
      "Failed to update workflow";
    throw new Error(msg);
  }
  return res.json() as Promise<Workflow>;
}

export function useUpdateWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<Workflow, Error, UpdateWorkflowVars>({
    mutationFn: updateWorkflow,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["workflows"] });
      void queryClient.invalidateQueries({
        queryKey: ["workflow", vars.workflowId],
      });
    },
  });
}
