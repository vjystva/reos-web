import { useQuery } from "@tanstack/react-query";
import type { WorkflowExecutionsResponse } from "@/types/api";

export interface UseWorkflowExecutionsArgs {
  workflowId?: string;
  limit?: number;
}

async function fetchExecutions(
  args: UseWorkflowExecutionsArgs,
): Promise<WorkflowExecutionsResponse> {
  const qs = new URLSearchParams();
  if (args.workflowId) qs.set("workflowId", args.workflowId);
  if (args.limit != null) qs.set("limit", String(args.limit));

  const url = qs.toString()
    ? `/api/workflows/executions?${qs.toString()}`
    : "/api/workflows/executions";
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch executions",
    );
  }
  return res.json() as Promise<WorkflowExecutionsResponse>;
}

export function useWorkflowExecutions(args: UseWorkflowExecutionsArgs = {}) {
  return useQuery<WorkflowExecutionsResponse, Error>({
    queryKey: [
      "workflow-executions",
      args.workflowId ?? null,
      args.limit ?? null,
    ],
    queryFn: () => fetchExecutions(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
