import { useQuery } from "@tanstack/react-query";
import type { UsersResponse } from "@/types/api";

async function fetchUsers(): Promise<UsersResponse> {
  const res = await fetch("/api/users");
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error((err as { error?: string }).error ?? "Failed to fetch users");
  }
  return res.json() as Promise<UsersResponse>;
}

export function useUsers() {
  return useQuery<UsersResponse, Error>({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 25_000,
    retry: 1,
  });
}
