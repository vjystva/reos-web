import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateUserRequest } from "@/types/api";

async function createUser(body: CreateUserRequest): Promise<unknown> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string; message?: string }).message ??
        (err as { error?: string }).error ??
        "Failed to create user",
    );
  }
  return res.json();
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
