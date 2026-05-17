import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CompleteTaskVars {
  taskId: string;
}

async function completeTask(vars: CompleteTaskVars): Promise<void> {
  const res = await fetch(
    `/api/tasks/${encodeURIComponent(vars.taskId)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (res.status === 403) {
    throw new Error("You do not have permission to complete this task.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to complete task";
    throw new Error(msg);
  }
}

export function useCompleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, CompleteTaskVars>({
    mutationFn: completeTask,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task", vars.taskId] });
    },
  });
}
