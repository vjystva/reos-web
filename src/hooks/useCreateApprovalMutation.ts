"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Approval, CreateApprovalRequest } from "@/types/api";

/**
 * Surfaces the backend's own message. Those messages are the product here —
 * "A discount of 2% or less does not require approval …", "Hold … is released —
 * only an active hold can be extended", "A pending discount_request already
 * exists for this booking" — so they are shown verbatim rather than replaced by
 * a generic failure string.
 */
async function createApproval(
  body: CreateApprovalRequest,
): Promise<Approval> {
  const res = await fetch("/api/approvals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      error?: string;
    };
    const message = Array.isArray(err.message)
      ? err.message.join(", ")
      : err.message;
    throw new Error(message ?? err.error ?? "Failed to raise the request");
  }
  return (await res.json()) as Approval;
}

export function useCreateApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation<Approval, Error, CreateApprovalRequest>({
    mutationFn: createApproval,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
  });
}
