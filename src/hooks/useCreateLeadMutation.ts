"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateLeadRequest, Lead } from "@/types/api";

async function createLead(body: CreateLeadRequest): Promise<Lead> {
  const payload = {
    ...body,
    email: body.email?.trim() || undefined,
  };
  const res = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to create lead";
    throw new Error(msg);
  }
  return res.json() as Promise<Lead>;
}

export function useCreateLeadMutation() {
  const qc = useQueryClient();
  return useMutation<Lead, Error, CreateLeadRequest>({
    mutationFn: createLead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
