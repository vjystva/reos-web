"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeadRoutingRule, UpdateLeadRoutingRuleRequest } from "@/types/api";

export interface UpdateLeadRoutingRuleVars {
  ruleId: string;
  body: UpdateLeadRoutingRuleRequest;
}

async function updateLeadRoutingRule(
  vars: UpdateLeadRoutingRuleVars,
): Promise<LeadRoutingRule> {
  const res = await fetch(
    `/api/lead-routing-rules/${encodeURIComponent(vars.ruleId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vars.body),
    },
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
    throw new Error(err.message ?? err.error ?? "Failed to update routing rule");
  }
  return res.json() as Promise<LeadRoutingRule>;
}

/**
 * PATCH /lead-routing-rules/:id. There is no bulk-save endpoint upstream, so
 * the settings page issues one PATCH per changed rule.
 */
export function useUpdateLeadRoutingRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation<LeadRoutingRule, Error, UpdateLeadRoutingRuleVars>({
    mutationFn: updateLeadRoutingRule,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-routing-rules"] });
    },
  });
}
