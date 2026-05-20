import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tenant } from "@/types/api";

export function useDeactivateTenantMutation() {
  const qc = useQueryClient();
  return useMutation<Tenant, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/super-admin/tenants/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to deactivate tenant");
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["super-admin", "tenants"] }); },
  });
}
