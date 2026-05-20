import { useQuery } from "@tanstack/react-query";
import { SystemStats } from "@/types/api";

export function useSystemStats() {
  return useQuery<SystemStats>({
    queryKey: ["super-admin", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/stats");
      if (!res.ok) throw new Error("Failed to fetch system stats");
      return res.json();
    },
    staleTime: 25_000,
    refetchInterval: 30_000,
  });
}
