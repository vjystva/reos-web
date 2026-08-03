import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Compact INR display using Indian lakh/crore short-form.
 *
 *   inr(12_500_000) → "₹1.25 Cr"
 *   inr(420_000)    → "₹4.2 L"
 *   inr(75_000)     → "₹75,000"
 *   inr(-50_000)    → "-₹50,000"
 *
 * Trailing zeros in the decimal part are trimmed ("₹4.2 L", not "₹4.20 L").
 * For full-precision, always-grouped currency use `formatCurrency()` in
 * `@/lib/formatCurrency`; this one is for dense tiles, tables and charts.
 */
export function inr(value: number): string {
  if (!Number.isFinite(value)) return "—";

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  const short = (n: number, unit: string): string =>
    `${sign}₹${parseFloat(n.toFixed(2))} ${unit}`;

  if (abs >= 10_000_000) return short(abs / 10_000_000, "Cr");
  if (abs >= 100_000) return short(abs / 100_000, "L");

  // Indian digit grouping (2,2,3) — e.g. ₹1,23,456
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  site_visit_scheduled: "Site Visit Scheduled",
  site_visit_done: "Site Visit Done",
  negotiation: "Negotiation",
  booking: "Booking",
  lost: "Lost",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
