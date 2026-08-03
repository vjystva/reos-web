import { statusTone, type StatusTone } from "@/components/StatusPill";
import type { MilestoneStatus } from "@/types/api";

/**
 * Booking & payment visual conventions — the money-side counterpart to
 * `leadTone.ts`, shared by the bookings list, the booking payments page, the
 * milestone list and the payment history table.
 *
 * ── Booking status → StatusPill tone ───────────────────────────────────────
 *   draft      → neutral  — nothing committed yet
 *   confirmed  → info     — in flight, collections running
 *   registered → good     — registration done, the milestone that counts
 *   completed  → good     — terminal success
 *   cancelled  → bad      — fell through
 *
 * The backend's `BookingStatusSchema` only enumerates draft/confirmed/
 * cancelled/completed, but the list endpoint's status filter has always
 * offered `registered` too, so it is mapped here rather than silently falling
 * through. Unknown strings fall back to the shared `statusTone()` heuristic.
 *
 * ── Milestone status ───────────────────────────────────────────────────────
 *   paid → good · due → warn · overdue → bad · pending → neutral · waived → neutral
 *
 * ── Payment status ─────────────────────────────────────────────────────────
 *   cleared → good · bounced → bad
 */

export const BOOKING_STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  confirmed: "info",
  registered: "good",
  completed: "good",
  cancelled: "bad",
};

export function bookingStatusTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  return BOOKING_STATUS_TONE[status.toLowerCase()] ?? statusTone(status);
}

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  registered: "Registered",
  completed: "Completed",
  cancelled: "Cancelled",
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

export const MILESTONE_STATUS_TONE: Record<MilestoneStatus, StatusTone> = {
  paid: "good",
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
  return status.charAt(0).toUpperCase() + status.slice(1);
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
