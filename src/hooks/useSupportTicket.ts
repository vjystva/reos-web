import { useQuery } from "@tanstack/react-query";
import type { SupportTicket } from "@/types/api";

async function fetchTicket(id: string): Promise<SupportTicket> {
  const res = await fetch(`/api/support-tickets/${encodeURIComponent(id)}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch ticket",
    );
  }
  return res.json() as Promise<SupportTicket>;
}

export function useSupportTicket(id: string | null) {
  return useQuery<SupportTicket, Error>({
    queryKey: ["support-ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
