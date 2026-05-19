import { useQuery } from "@tanstack/react-query";
import type { Workflow } from "@/types/api";

async function fetchWorkflow(id: string): Promise<Workflow> {
  const res = await fetch(`/api/workflows/${encodeURIComponent(id)}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch workflow",
    );
  }
  return res.json() as Promise<Workflow>;
}

export function useWorkflow(id: string | null) {
  return useQuery<Workflow, Error>({
    queryKey: ["workflow", id],
    queryFn: () => fetchWorkflow(id!),
    enabled: !!id,
    staleTime: 25_000,
    retry: 1,
  });
}
