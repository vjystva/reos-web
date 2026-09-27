"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ResolvedApproval } from "@/types/api";

export interface ResolveApprovalVariables {
  approvalId: string;
  action: "approve" | "reject";
  resolutionNote?: string;
}

async function resolveApproval({
  approvalId,
  action,
  resolutionNote,
}: ResolveApprovalVariables): Promise<ResolvedApproval> {
  const res = await fetch(
    `/api/approvals/${encodeURIComponent(approvalId)}/${action}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resolutionNote ? { resolutionNote } : {}),
    },
  );
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
    throw new Error(
      message ??
        err.error ??
        `Failed to ${action === "approve" ? "approve" : "reject"} the request`,
    );
  }
  return (await res.json()) as ResolvedApproval;
}

/**
 * Approve or reject. Approving has real downstream effects, so the caches those
 * effects invalidate are refreshed too: `bookings` (discount_percent changes)
 * and `holds` (expires_at moves).
 */
export function useResolveApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation<ResolvedApproval, Error, ResolveApprovalVariables>({
    mutationFn: resolveApproval,
    onSuccess: (resolved) => {
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      if (resolved.effect?.kind === "booking_discount") {
        void queryClient.invalidateQueries({ queryKey: ["bookings"] });
        void queryClient.invalidateQueries({ queryKey: ["booking"] });
      }
      if (resolved.effect?.kind === "hold_extension") {
        void queryClient.invalidateQueries({ queryKey: ["holds"] });
      }
    },
  });
}
