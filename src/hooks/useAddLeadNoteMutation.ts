"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateLeadActivityRequest } from "@/types/api";

export class LeadActivityError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "LeadActivityError";
    this.status = status;
    this.body = body;
  }
}

function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message) return rec.message;
    if (Array.isArray(rec.message) && typeof rec.message[0] === "string") {
      return rec.message[0];
    }
    if (typeof rec.details === "string" && rec.details) return rec.details;
    if (typeof rec.error === "string" && rec.error) return rec.error;
  }
  return `add_lead_activity_failed_${status}`;
}

async function postLeadActivity(
  id: string,
  vars: CreateLeadActivityRequest,
): Promise<void> {
  const res = await fetch(
    `/api/leads/${encodeURIComponent(id)}/activities`,
    {
      method: "POST",
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
    throw new LeadActivityError(
      res.status,
      body,
      extractMessage(body, res.status),
    );
  }
}

/**
 * Appends a note to a lead's activity timeline via
 * `POST /api/leads/:id/activities` -> backend `POST /leads/:id/activities`
 * with `{ activityType: "note", body }`.
 *
 * Notes are NOT a column on `leads`; `useUpdateLeadMutation({ notes })` is
 * rejected upstream with 400 "property notes should not exist".
 */
export function useAddLeadNoteMutation(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (note: string) =>
      postLeadActivity(id, { activityType: "note", body: note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leadActivities", id] });
      void qc.invalidateQueries({ queryKey: ["leads", id] });
    },
  });
}
