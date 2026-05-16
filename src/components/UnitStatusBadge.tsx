import * as React from "react";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  available: "bg-green-700 text-white",
  blocked: "bg-amber-400 text-slate-900",
  booked: "bg-blue-700 text-white",
  sold: "bg-slate-700 text-white",
  held: "bg-slate-400 text-white",
};

const LABELS: Record<string, string> = {
  available: "AVAILABLE",
  blocked: "BLOCKED",
  booked: "BOOKED",
  sold: "SOLD",
  held: "HELD",
};

interface UnitStatusBadgeProps {
  status: string | undefined;
  className?: string;
}

/**
 * Colour + always-visible text label (WCAG: colour is never the sole
 * differentiator). `role="img"` because the badge is a static label, not a
 * live region (frontend review nit 1).
 */
export function UnitStatusBadge({ status, className }: UnitStatusBadgeProps) {
  const key = (status ?? "").toLowerCase();
  const colour = COLORS[key] ?? "bg-slate-300 text-slate-900";
  const label = LABELS[key] ?? (status ? status.toUpperCase() : "—");
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
