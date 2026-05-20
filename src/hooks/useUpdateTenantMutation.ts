import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tenant, UpdateTenantRequest } from "@/types/api";

export function useUpdateTenantMutation() {
  const qc = useQueryClient();
  return useMutation<Tenant, Error, { id: string } & UpdateTenantRequest>({
    mutationFn: async ({ id, ...data }) => {
      const res = await fetch(`/api/super-admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to update tenant");
      }
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["super-admin", "tenants"] });
      qc.invalidateQueries({ queryKey: ["super-admin", "tenants", id] });
    },
  });
}
