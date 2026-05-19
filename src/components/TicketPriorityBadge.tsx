import * as React from "react";
import { cn } from "@/lib/utils";
import type { TicketPriority } from "@/types/api";

const COLORS: Record<TicketPriority, string> = {
  low: "bg-slate-500 text-white",
  medium: "bg-blue-600 text-white",
  high: "bg-amber-500 text-white",
  urgent: "bg-red-600 text-white",
};

const LABELS: Record<TicketPriority, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
};

interface TicketPriorityBadgeProps {
  priority: TicketPriority | string | undefined;
  className?: string;
}

/**
 * Priority badge for support tickets.
 */
export function TicketPriorityBadge({
  priority,
  className,
}: TicketPriorityBadgeProps) {
  const key = (priority ?? "").toLowerCase() as TicketPriority;
  const colour = COLORS[key] ?? "bg-slate-300 text-slate-900";
  const label =
    LABELS[key] ?? (priority ? String(priority).toUpperCase() : "—");
  return (
    <span
      role="img"
      aria-label={`Priority: ${label}`}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
        colour,
        className,
      )}
    >
      {label}
    </span>
  );
}
