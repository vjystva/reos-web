import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DeleteTaskVars {
  taskId: string;
}

async function deleteTask(vars: DeleteTaskVars): Promise<void> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(vars.taskId)}`, {
    method: "DELETE",
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (res.status === 403) {
    throw new Error("You do not have permission to delete this task.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to delete task";
    throw new Error(msg);
  }
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, DeleteTaskVars>({
    mutationFn: deleteTask,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task", vars.taskId] });
    },
  });
}
