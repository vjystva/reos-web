"use client";

import { useMutation } from "@tanstack/react-query";
import { LeadsResponseSchema } from "@/types/api";
import { phoneKey, type ExistingMatch } from "@/lib/leadImport";

/**
 * Duplicate pre-check for the bulk import screen.
 *
 * There is NO dedicated dedupe endpoint on the backend: `csv-import.service.ts`
 * inserts every valid row and `leads.phone` has no unique constraint. The only
 * existing capability we can lean on is the lead list search —
 * `GET /leads?q=` runs `first_name/last_name/phone/email ILIKE %q%` — so this
 * hook probes one query per distinct phone number and keeps hits whose phone
 * matches on digits.
 *
 * Consequences the UI must state honestly:
 *   - it is advisory; the import will still create the lead if the user proceeds
 *   - `q` matches stored text, so a duplicate saved in a different format may
 *     be missed (we re-verify hits by digits to avoid false positives)
 *   - capped at MAX_PROBES distinct numbers to bound request volume
 */

const MAX_PROBES = 100;
const CONCURRENCY = 6;

export interface DuplicateCheckResult {
  /** phoneKey → existing lead. */
  matches: Map<string, ExistingMatch>;
  /** Distinct numbers actually probed. */
  checked: number;
  /** Distinct numbers skipped because of the probe cap. */
  skipped: number;
}

async function probePhone(phone: string): Promise<ExistingMatch | null> {
  const qs = new URLSearchParams({ q: phone.trim(), pageSize: "5" });
  const res = await fetch(`/api/leads?${qs.toString()}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`duplicate_check_failed_${res.status}`);
  const parsed = LeadsResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("leads_shape_mismatch");

  const wanted = phoneKey(phone);
  const hit = parsed.data.data.find((lead) => phoneKey(lead.phone) === wanted);
  if (!hit) return null;
  return { id: hit.id, name: hit.name || "existing lead" };
}

async function checkDuplicates(phones: string[]): Promise<DuplicateCheckResult> {
  const distinct = Array.from(
    new Map(
      phones
        .map((p) => [phoneKey(p), p] as const)
        .filter(([key]) => key.length > 0),
    ).values(),
  );

  const probes = distinct.slice(0, MAX_PROBES);
  const matches = new Map<string, ExistingMatch>();

  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= probes.length) return;
      const phone = probes[i];
      try {
        const hit = await probePhone(phone);
        if (hit) matches.set(phoneKey(phone), hit);
      } catch {
        // A failed probe must not fail the whole check — treat as "unknown".
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, probes.length) }, worker),
  );

  return {
    matches,
    checked: probes.length,
    skipped: distinct.length - probes.length,
  };
}

export function useDuplicateLeadCheck() {
  return useMutation<DuplicateCheckResult, Error, string[]>({
    mutationFn: checkDuplicates,
  });
}

export const DUPLICATE_CHECK_MAX_PROBES = MAX_PROBES;
