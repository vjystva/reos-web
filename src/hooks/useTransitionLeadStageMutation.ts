"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TransitionLeadStageRequest } from "@/types/api";

/**
 * Carries the upstream HTTP status + the backend's own message so callers can
 * surface the real reason ("Invalid stage transition: contacted ->
 * negotiation", "lostReason is required when moving to lost") instead of a
 * generic "Could not update the stage."
 */
export class LeadStageTransitionError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "LeadStageTransitionError";
    this.status = status;
    this.body = body;
  }
}

function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    // Nest returns `message` as string OR string[] on validation failures.
    if (typeof rec.message === "string" && rec.message) return rec.message;
    if (Array.isArray(rec.message) && typeof rec.message[0] === "string") {
      return rec.message[0];
    }
    if (typeof rec.error === "string" && rec.error) return rec.error;
  }
  return `transition_lead_stage_failed_${status}`;
}

async function transitionLeadStage(
  id: string,
  vars: TransitionLeadStageRequest,
): Promise<void> {
  const res = await fetch(
    `/api/leads/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vars),
    },
  );

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new LeadStageTransitionError(
      res.status,
      body,
      extractMessage(body, res.status),
    );
  }
}

/**
 * Moves a lead through the pipeline via `PATCH /api/leads/:id/status`, which
 * the BFF rewrites to backend `POST /leads/:id/stage` ({ toStage }).
 *
 * Use this — NOT `useUpdateLeadMutation({ stage })`. `stage` is not a member
 * of the backend's `UpdateLeadDto`, so `PATCH /leads/:id` rejects it outright
 * with 400 "property stage should not exist". `useUpdateLeadMutation` stays
 * for the fields `UpdateLeadDto` does whitelist (name, phone, email, budget,
 * preferredLocation, projectInterest, projectId, partnerId).
 *
 * Same cache-invalidation contract as `useUpdateLeadMutation`: the single
 * lead and every leads list (pipeline board, table, booking picker).
 */
export function useTransitionLeadStageMutation(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, TransitionLeadStageRequest>({
    mutationFn: (vars) => transitionLeadStage(id, vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leads", id] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
      // Stage moves append a `stage_change` row to the activity timeline.
      void qc.invalidateQueries({ queryKey: ["leadActivities", id] });
    },
  });
}
