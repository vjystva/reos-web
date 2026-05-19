import * as React from "react";
import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/types/api";

const COLORS: Record<TicketStatus, string> = {
  open: "bg-blue-600 text-white",
  in_progress: "bg-amber-500 text-white",
  resolved: "bg-green-700 text-white",
  closed: "bg-slate-500 text-white",
};

const LABELS: Record<TicketStatus, string> = {
  open: "OPEN",
  in_progress: "IN PROGRESS",
  resolved: "RESOLVED",
  closed: "CLOSED",
};

interface TicketStatusBadgeProps {
  status: TicketStatus | string | undefined;
  className?: string;
}

/**
 * Status badge for support tickets.
 * Colour + always-visible label so colour is never the sole differentiator.
 */
export function TicketStatusBadge({
  status,
  className,
}: TicketStatusBadgeProps) {
  const key = (status ?? "").toLowerCase() as TicketStatus;
  const colour = COLORS[key] ?? "bg-slate-300 text-slate-900";
  const label = LABELS[key] ?? (status ? String(status).toUpperCase() : "—");
  return (
    <span
      role="img"
      aria-label={`Status: ${label}`}
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
