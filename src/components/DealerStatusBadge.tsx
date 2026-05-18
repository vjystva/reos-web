import * as React from "react";
import { cn } from "@/lib/utils";
import type { DealerStatus } from "@/types/api";

const COLORS: Record<DealerStatus, string> = {
  active: "bg-green-600 text-white",
  inactive: "bg-slate-500 text-white",
  suspended: "bg-red-600 text-white",
};

const LABELS: Record<DealerStatus, string> = {
  active: "ACTIVE",
  inactive: "INACTIVE",
  suspended: "SUSPENDED",
};

interface DealerStatusBadgeProps {
  status: DealerStatus | string | undefined;
  className?: string;
}

/**
 * Status badge for dealers.
 * Colour + always-visible label so colour is never the sole differentiator.
 */
export function DealerStatusBadge({
  status,
  className,
}: DealerStatusBadgeProps) {
  const key = (status ?? "").toLowerCase() as DealerStatus;
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
