import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTaskRequest, Task } from "@/types/api";

async function createTask(body: CreateTaskRequest): Promise<Task> {
  const res = await fetch("/api/tasks", {
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
      "Failed to create task";
    throw new Error(msg);
  }
  return res.json() as Promise<Task>;
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation<Task, Error, CreateTaskRequest>({
    mutationFn: createTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
