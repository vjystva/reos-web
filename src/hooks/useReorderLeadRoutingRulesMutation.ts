"use client";

import { extractApiErrorMessage } from "@/lib/mutationError";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  LeadRoutingRulesResponse,
  ReorderLeadRoutingRulesRequest,
} from "@/types/api";

async function reorderLeadRoutingRules(
  body: ReorderLeadRoutingRulesRequest,
): Promise<LeadRoutingRulesResponse> {
  const res = await fetch("/api/lead-routing-rules/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(await extractApiErrorMessage(res, "Failed to reorder routing rules"));
  }
  return res.json() as Promise<LeadRoutingRulesResponse>;
}

/**
 * PATCH /lead-routing-rules/reorder — sends every (id, priority) pair that
 * moved in one atomic batch. Lower priority = evaluated first.
 */
export function useReorderLeadRoutingRulesMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    LeadRoutingRulesResponse,
    Error,
    ReorderLeadRoutingRulesRequest
  >({
    mutationFn: reorderLeadRoutingRules,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-routing-rules"] });
    },
  });
}
