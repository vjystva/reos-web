"use client";

import { extractApiErrorMessage } from "@/lib/mutationError";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateLeadRoutingRuleRequest, LeadRoutingRule } from "@/types/api";

async function createLeadRoutingRule(
  body: CreateLeadRoutingRuleRequest,
): Promise<LeadRoutingRule> {
  const res = await fetch("/api/lead-routing-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(await extractApiErrorMessage(res, "Failed to create routing rule"));
  }
  return res.json() as Promise<LeadRoutingRule>;
}

export function useCreateLeadRoutingRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation<LeadRoutingRule, Error, CreateLeadRoutingRuleRequest>({
    mutationFn: createLeadRoutingRule,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-routing-rules"] });
    },
  });
}
