import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tenant, CreateTenantRequest } from "@/types/api";

export function useCreateTenantMutation() {
  const qc = useQueryClient();
  return useMutation<Tenant, Error, CreateTenantRequest>({
    mutationFn: async (data) => {
      const res = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create tenant");
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["super-admin", "tenants"] }); },
  });
}
