import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateTaskRequest } from "@/types/api";

interface UpdateTaskVars {
  taskId: string;
  body: UpdateTaskRequest;
}

async function updateTask(vars: UpdateTaskVars): Promise<void> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(vars.taskId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vars.body),
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
      "Failed to update task";
    throw new Error(msg);
  }
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, UpdateTaskVars>({
    mutationFn: updateTask,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task", vars.taskId] });
    },
  });
}
