import { useQuery } from "@tanstack/react-query";
import { TenantsResponse } from "@/types/api";

export function useTenantsAdmin(filters?: { plan?: string; isActive?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.plan) params.set("plan", filters.plan);
  if (filters?.isActive !== undefined) params.set("isActive", String(filters.isActive));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return useQuery<TenantsResponse>({
    queryKey: ["super-admin", "tenants", filters],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants${qs}`);
      if (!res.ok) throw new Error("Failed to fetch tenants");
      return res.json();
    },
    staleTime: 25_000,
    refetchInterval: 30_000,
  });
}
