import { useQuery } from "@tanstack/react-query";
import type { Task } from "@/types/api";

async function fetchTask(taskId: string): Promise<Task> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch task",
    );
  }
  return res.json() as Promise<Task>;
}

export function useTask(taskId: string | null) {
  return useQuery<Task, Error>({
    queryKey: ["task", taskId],
    queryFn: () => fetchTask(taskId!),
    enabled: !!taskId,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
