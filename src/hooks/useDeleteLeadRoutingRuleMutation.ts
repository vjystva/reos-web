"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

async function deleteLeadRoutingRule(ruleId: string): Promise<void> {
  const res = await fetch(
    `/api/lead-routing-rules/${encodeURIComponent(ruleId)}`,
    { method: "DELETE" },
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(err.message ?? err.error ?? "Failed to delete routing rule");
  }
}

export function useDeleteLeadRoutingRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteLeadRoutingRule,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-routing-rules"] });
    },
  });
}
