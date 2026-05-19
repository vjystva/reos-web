import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateWorkflowRequest, Workflow } from "@/types/api";

async function createWorkflow(body: CreateWorkflowRequest): Promise<Workflow> {
  const res = await fetch("/api/workflows", {
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
      "Failed to create workflow";
    throw new Error(msg);
  }
  return res.json() as Promise<Workflow>;
}

export function useCreateWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<Workflow, Error, CreateWorkflowRequest>({
    mutationFn: createWorkflow,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}
