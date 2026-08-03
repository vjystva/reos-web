import { useQuery } from "@tanstack/react-query";
import type { WorkflowsResponse } from "@/types/api";

export interface UseWorkflowsArgs {
  isActive?: boolean;
  page?: number;
  limit?: number;
}

async function fetchWorkflows(
  args: UseWorkflowsArgs,
): Promise<WorkflowsResponse> {
  const qs = new URLSearchParams();
  if (args.isActive != null) qs.set("isActive", String(args.isActive));
  if (args.page != null) qs.set("page", String(args.page));
  if (args.limit != null) qs.set("limit", String(args.limit));

  const url = qs.toString()
    ? `/api/workflows?${qs.toString()}`
    : "/api/workflows";
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(err.message ?? err.error ?? "Failed to fetch workflows");
  }
  return res.json() as Promise<WorkflowsResponse>;
}

export function useWorkflows(args: UseWorkflowsArgs = {}) {
  return useQuery<WorkflowsResponse, Error>({
    queryKey: [
      "workflows",
      args.isActive ?? null,
      args.page ?? null,
      args.limit ?? null,
    ],
    queryFn: () => fetchWorkflows(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
