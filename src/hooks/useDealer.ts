import { useQuery } from "@tanstack/react-query";
import type { Dealer } from "@/types/api";

async function fetchDealer(dealerId: string): Promise<Dealer> {
  const res = await fetch(`/api/dealers/${encodeURIComponent(dealerId)}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch dealer",
    );
  }
  return res.json() as Promise<Dealer>;
}

export function useDealer(dealerId: string | null) {
  return useQuery<Dealer, Error>({
    queryKey: ["dealers", dealerId],
    queryFn: () => fetchDealer(dealerId!),
    enabled: !!dealerId,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
