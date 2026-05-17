"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateLeadRequest } from "@/types/api";

async function updateLead(id: string, data: UpdateLeadRequest): Promise<void> {
  const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update_lead_failed_${res.status}`);
}

export function useUpdateLeadMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateLeadRequest) => updateLead(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leads", id] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
