import * as React from "react";
import { cn } from "@/lib/utils";
import type { SiteVisitStatus } from "@/types/api";

const COLORS: Record<SiteVisitStatus, string> = {
  scheduled: "bg-blue-600 text-white",
  confirmed: "bg-green-700 text-white",
  completed: "bg-slate-700 text-white",
  cancelled: "bg-red-600 text-white",
};

const LABELS: Record<SiteVisitStatus, string> = {
  scheduled: "SCHEDULED",
  confirmed: "CONFIRMED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

interface SiteVisitStatusBadgeProps {
  status: SiteVisitStatus | string | undefined;
  className?: string;
}

/**
 * Status badge for site visits.
 * Colour + always-visible label so colour is never the sole differentiator.
 */
export function SiteVisitStatusBadge({ status, className }: SiteVisitStatusBadgeProps) {
  const key = (status ?? "").toLowerCase() as SiteVisitStatus;
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
