import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Tone-based status chip.
 *
 *   <StatusPill tone="good">Booked</StatusPill>
 *
 * Domain strings (lead stage, lead temperature, unit status, booking status,
 * dealer status, ticket status, workflow execution status) map onto a tone via
 * a per-domain lookup owned by the caller — see `statusTone()` below for the
 * shared convention:
 *
 *   good    → terminal success / healthy   (green,  chart-4)
 *   bad     → failure / lost / cancelled   (red,    destructive)
 *   warn    → needs attention / pending    (amber,  accent)
 *   info    → in-flight / informational    (teal,   chart-2)
 *   neutral → default, no signal           (muted-foreground)
 */

export const STATUS_TONES = [
  "neutral",
  "info",
  "warn",
  "good",
  "bad",
] as const;

export type StatusTone = (typeof STATUS_TONES)[number];

const statusPillVariants = cva(
  "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none",
  {
    variants: {
      tone: {
        neutral:
          "border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground",
        info: "border-chart-2/30 bg-chart-2/10 text-chart-2",
        warn: "border-accent/30 bg-accent/10 text-accent-foreground",
        good: "border-chart-4/30 bg-chart-4/10 text-chart-4",
        bad: "border-destructive/30 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  tone?: StatusTone;
}

export function StatusPill({
  tone = "neutral",
  className,
  ...props
}: StatusPillProps) {
  return (
    <span className={cn(statusPillVariants({ tone }), className)} {...props} />
  );
}

/**
 * Shared fallback mapper for domain status strings.
 *
 * Per-domain maps (lead stage, unit status, …) are intentionally NOT baked in
 * here — the page/component sweep owns those. Callers should pass their own
 * map and fall back to this heuristic:
 *
 *   const TONE: Record<string, StatusTone> = { available: "good", held: "warn" };
 *   <StatusPill tone={TONE[status] ?? statusTone(status)}>{label}</StatusPill>
 */
export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  const s = status.toLowerCase();

  if (/(lost|cancel|fail|error|reject|overdue|expired|churn|blocked)/.test(s)) {
    return "bad";
  }
  if (/(booked|complete|success|approved|active|paid|won|closed_won|done|available|resolved)/.test(s)) {
    return "good";
  }
  if (/(pending|hold|held|await|due|warn|review|escalat|negotiat|suspend)/.test(s)) {
    return "warn";
  }
  if (/(new|open|running|in_progress|progress|scheduled|contacted|assigned|queued)/.test(s)) {
    return "info";
  }
  return "neutral";
}
