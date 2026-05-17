"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

async function convertLead(id: string): Promise<void> {
  const res = await fetch(`/api/leads/${encodeURIComponent(id)}/convert`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`convert_lead_failed_${res.status}`);
}

export function useConvertLeadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => convertLead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
