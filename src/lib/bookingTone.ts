import { statusTone, type StatusTone } from "@/components/StatusPill";
import type { MilestoneStatus } from "@/types/api";

/**
 * Booking & payment visual conventions — the money-side counterpart to
 * `leadTone.ts`, shared by the bookings list, the booking payments page, the
 * milestone list and the payment history table.
 *
 * ── Booking status → StatusPill tone ───────────────────────────────────────
 * The real lifecycle (backend `BOOKING_STATUSES`) is:
 *   application_received → neutral — application in, nothing committed
 *   under_review         → info    — builder assessing
 *   approved             → info    — THE "confirmed" point; unit -> booked
 *   payment_received     → info    — collections running
 *   agreement_signed     → good    — paperwork done
 *   registered           → good    — registration done, the one that counts
 *   cancelled            → bad     — fell through
 *
 * The legacy draft/confirmed/completed keys are retained below so any older
 * persisted rows or cached payloads still render a sensible pill, but they
 * are NOT valid filter values — see `BOOKING_STATUSES` in `@/types/api`.
 * Unknown strings fall back to the shared `statusTone()` heuristic.
 *
 * ── Milestone status ───────────────────────────────────────────────────────
 *   paid → good · due → warn · overdue → bad · partially_paid → info ·
 *   pending → neutral · waived → neutral
 *
 * ── Payment status ─────────────────────────────────────────────────────────
 *   cleared → good · bounced → bad
 */

export const BOOKING_STATUS_TONE: Record<string, StatusTone> = {
  // Real lifecycle
  application_received: "neutral",
  under_review: "info",
  approved: "info",
  payment_received: "info",
  agreement_signed: "good",
  registered: "good",
  cancelled: "bad",
  // Legacy values kept for backward compatibility with cached payloads
  draft: "neutral",
  confirmed: "info",
  completed: "good",
};

export function bookingStatusTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  return BOOKING_STATUS_TONE[status.toLowerCase()] ?? statusTone(status);
}

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  // Real lifecycle
  application_received: "Application received",
  under_review: "Under review",
  approved: "Approved",
  payment_received: "Payment received",
  agreement_signed: "Agreement signed",
  registered: "Registered",
  cancelled: "Cancelled",
  // Legacy values kept for backward compatibility with cached payloads
  draft: "Draft",
  confirmed: "Confirmed",
  completed: "Completed",
};

export function bookingStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const key = status.toLowerCase();
  if (BOOKING_STATUS_LABEL[key]) return BOOKING_STATUS_LABEL[key];
  const s = status.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Statuses that count as "registered" for the headline tile. */
export const REGISTERED_BOOKING_STATUSES = ["registered", "completed"];

/**
 * Statuses that count as an *active/confirmed* booking for the headline tile.
 * `approved` is the backend's confirmation point (`BOOKING_CONFIRMED_STATUS`);
 * everything after it is downstream fulfilment of an already-confirmed
 * booking. The tile used to count `status === "confirmed"`, a value the
 * backend never emits, so it always read 0.
 */
export const ACTIVE_BOOKING_STATUSES = [
  "approved",
  "payment_received",
  "agreement_signed",
  "confirmed",
];

/**
 * Human label for a backend payment mode (`PAYMENT_MODES`). The wire values
 * are lowercase snake_case; the acronyms read badly unless upper-cased.
 */
export const PAYMENT_MODE_LABEL: Record<string, string> = {
  cheque: "Cheque",
  neft: "NEFT",
  rtgs: "RTGS",
  cash: "Cash",
  upi: "UPI",
  demand_draft: "Demand draft",
};

export function paymentModeLabel(mode: string | null | undefined): string {
  if (!mode) return "—";
  return PAYMENT_MODE_LABEL[mode] ?? mode;
}

export const MILESTONE_STATUS_TONE: Record<MilestoneStatus, StatusTone> = {
  paid: "good",
  partially_paid: "info",
  due: "warn",
  overdue: "bad",
  pending: "neutral",
  waived: "neutral",
};

export function milestoneStatusTone(status: string | null | undefined): StatusTone {
  return (
    MILESTONE_STATUS_TONE[(status ?? "") as MilestoneStatus] ?? "neutral"
  );
}

export function milestoneStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const s = status.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function paymentStatusTone(status: string | null | undefined): StatusTone {
  return status === "bounced" ? "bad" : "good";
}

/**
 * Collection progress as a 0–100 integer. Returns `null` when the total is
 * missing or non-positive so callers can render "—" instead of a misleading
 * empty bar.
 */
export function collectionPercent(
  collected: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (collected == null || total == null) return null;
  if (!Number.isFinite(collected) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((collected / total) * 100)));
}

/**
 * Progress-bar fill for a collection percentage — red under 25%, amber under
 * 75%, green at or above it. Same three-step read as the StatusPill tones.
 */
export function collectionIndicatorClass(percent: number | null): string {
  if (percent == null) return "bg-muted-foreground/40";
  if (percent >= 75) return "bg-chart-4";
  if (percent >= 25) return "bg-accent";
  return "bg-destructive";
}

/** Coerce API money fields that may arrive as strings (or be absent). */
export function toAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
