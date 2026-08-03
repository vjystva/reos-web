import type { StatusTone } from "@/components/StatusPill";
import { UNIT_STATUSES, type UnitStatus } from "@/types/api";

/**
 * Unit inventory visual conventions — single source of truth shared by the
 * unit grid, the unit tile, the unit slide-over, the inventory StatCards and
 * the project detail legend, mirroring the pattern `leadTone.ts` established
 * for lead stages.
 *
 * ── Unit status → StatusPill tone ──────────────────────────────────────────
 * The scale answers "can I still sell this?" rather than "is this good news?",
 * because that is the question an inventory screen exists to answer:
 *
 *   available         → good     — sellable right now, the one actionable state
 *   on_hold           → warn     — soft hold, expires, needs a decision
 *   blocked           → warn     — held out of sale, needs a decision
 *   booked            → info     — in flight through the sale pipeline
 *   agreement_signed  → info     — in flight, further along
 *   registered        → neutral  — terminal, money banked; see emphasis below
 *   handed_over       → neutral  — terminal, nothing left to do
 *   cancelled         → bad      — fell through, unit returns to the funnel
 *
 * `registered` / `handed_over` deliberately do NOT get `good`: on an inventory
 * board green means "you can sell this", and a registered unit is the opposite.
 * They would fade into the noise as plain neutral though, so they carry an
 * emphasis override (`UNIT_STATUS_EMPHASIS`) that swaps the muted foreground
 * for the full-contrast one — neutral hue, higher weight.
 */

export const UNIT_STATUS_TONE: Record<UnitStatus, StatusTone> = {
  available: "good",
  on_hold: "warn",
  blocked: "warn",
  booked: "info",
  agreement_signed: "info",
  registered: "neutral",
  handed_over: "neutral",
  cancelled: "bad",
};

export function unitStatusTone(status: string | null | undefined): StatusTone {
  return UNIT_STATUS_TONE[(status ?? "").toLowerCase() as UnitStatus] ?? "neutral";
}

/** Extra chip classes for the terminal states — neutral hue, full contrast. */
export const UNIT_STATUS_EMPHASIS: Partial<Record<UnitStatus, string>> = {
  registered: "border-foreground/25 bg-foreground/10 text-foreground",
  handed_over: "border-foreground/25 bg-foreground/10 text-foreground",
};

export function unitStatusEmphasis(status: string | null | undefined): string {
  return UNIT_STATUS_EMPHASIS[(status ?? "").toLowerCase() as UnitStatus] ?? "";
}

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  available: "Available",
  on_hold: "On hold",
  blocked: "Blocked",
  booked: "Booked",
  agreement_signed: "Agreement signed",
  registered: "Registered",
  handed_over: "Handed over",
  cancelled: "Cancelled",
};

export function unitStatusLabel(status: string | null | undefined): string {
  const key = (status ?? "").toLowerCase() as UnitStatus;
  if (UNIT_STATUS_LABEL[key]) return UNIT_STATUS_LABEL[key];
  if (!status) return "—";
  const s = status.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Solid dot fill for grid tiles + the legend, same hue scale as the pill. */
export const UNIT_STATUS_DOT: Record<UnitStatus, string> = {
  available: "bg-chart-4",
  on_hold: "bg-accent",
  blocked: "bg-accent",
  booked: "bg-chart-2",
  agreement_signed: "bg-chart-2",
  registered: "bg-foreground/60",
  handed_over: "bg-foreground/60",
  cancelled: "bg-destructive",
};

export function unitStatusDot(status: string | null | undefined): string {
  return (
    UNIT_STATUS_DOT[(status ?? "").toLowerCase() as UnitStatus] ??
    "bg-muted-foreground/40"
  );
}

/**
 * The reference inventory screen shows four count tiles. Our lifecycle has
 * eight states, so they collapse onto the four buckets that actually drive a
 * decision — every status lands in exactly one bucket except `cancelled`,
 * which is intentionally excluded (a cancelled unit is neither held nor sold;
 * it is surfaced through the status filter instead of a headline tile).
 */
export const UNIT_STATUS_BUCKETS = [
  { key: "available", label: "Available", statuses: ["available"] },
  { key: "held", label: "On hold", statuses: ["on_hold", "blocked"] },
  { key: "booked", label: "Booked", statuses: ["booked", "agreement_signed"] },
  {
    key: "registered",
    label: "Registered",
    statuses: ["registered", "handed_over"],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  statuses: ReadonlyArray<UnitStatus>;
}>;

export type UnitStatusBucketKey = (typeof UNIT_STATUS_BUCKETS)[number]["key"];

/** Per-status counts for a list of units (statuses default to 0). */
export function countUnitStatuses(
  units: ReadonlyArray<{ status?: string | null }>,
): Record<UnitStatus, number> {
  const counts = Object.fromEntries(
    UNIT_STATUSES.map((s) => [s, 0]),
  ) as Record<UnitStatus, number>;
  for (const u of units) {
    const key = (u.status ?? "").toLowerCase() as UnitStatus;
    if (key in counts) counts[key] += 1;
  }
  return counts;
}

/** Bucketed counts in `UNIT_STATUS_BUCKETS` order, ready for the StatCards. */
export function unitStatusBucketCounts(
  units: ReadonlyArray<{ status?: string | null }>,
): { key: UnitStatusBucketKey; label: string; count: number }[] {
  const counts = countUnitStatuses(units);
  return UNIT_STATUS_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    count: b.statuses.reduce((sum, s) => sum + counts[s], 0),
  }));
}
