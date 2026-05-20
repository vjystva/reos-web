import { useQuery } from "@tanstack/react-query";
import { TenantStats } from "@/types/api";

export function useTenantAdmin(id: string) {
  return useQuery<TenantStats>({
    queryKey: ["super-admin", "tenants", id],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${id}`);
      if (!res.ok) throw new Error("Failed to fetch tenant");
      return res.json();
    },
    enabled: Boolean(id),
    staleTime: 25_000,
  });
}
