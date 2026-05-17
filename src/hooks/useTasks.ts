import { useQuery } from "@tanstack/react-query";
import type { TaskPriority, TaskStatus, TasksResponse } from "@/types/api";

export interface UseTasksArgs {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

async function fetchTasks(args: UseTasksArgs): Promise<TasksResponse> {
  const qs = new URLSearchParams();
  if (args.status) qs.set("status", args.status);
  if (args.priority) qs.set("priority", args.priority);
  if (args.assignedTo) qs.set("assignedTo", args.assignedTo);
  if (args.page != null) qs.set("page", String(args.page));
  if (args.limit != null) qs.set("limit", String(args.limit));

  const url = qs.toString() ? `/api/tasks?${qs.toString()}` : "/api/tasks";
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch tasks",
    );
  }
  return res.json() as Promise<TasksResponse>;
}

export function useTasks(args: UseTasksArgs = {}) {
  return useQuery<TasksResponse, Error>({
    queryKey: [
      "tasks",
      args.status ?? null,
      args.priority ?? null,
      args.assignedTo ?? null,
      args.page ?? null,
      args.limit ?? null,
    ],
    queryFn: () => fetchTasks(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
