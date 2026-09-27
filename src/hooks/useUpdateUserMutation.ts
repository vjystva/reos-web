import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateUserRequest } from "@/types/api";

interface UpdateUserVars {
  userId: string;
  body: UpdateUserRequest;
}

async function updateUser(vars: UpdateUserVars): Promise<unknown> {
  const res = await fetch(`/api/users/${encodeURIComponent(vars.userId)}`, {
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
    throw new Error(
      (err as { message?: string }).message ??
        (err as { error?: string }).error ??
        "Failed to update user",
    );
  }
  return res.json();
}

export function useUpdateUserMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, UpdateUserVars>({
    mutationFn: updateUser,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
