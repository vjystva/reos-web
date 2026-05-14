import * as React from "react";
import { cn } from "@/lib/utils";
import type { LeadTemperature } from "@/types/api";

const COLORS: Record<LeadTemperature, string> = {
  hot: "bg-red-600 text-white",
  warm: "bg-amber-600 text-white",
  cold: "bg-blue-600 text-white",
};

const LABELS: Record<LeadTemperature, string> = {
  hot: "HOT",
  warm: "WARM",
  cold: "COLD",
};

interface TemperatureBadgeProps {
  temperature: LeadTemperature;
  className?: string;
}

/**
 * Color + text label. Text is always rendered so color is never the sole
 * differentiator (WCAG SC 1.4.1).
 */
export function TemperatureBadge({
  temperature,
  className,
}: TemperatureBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tracking-wide",
        COLORS[temperature],
        className,
      )}
      aria-label={`Temperature: ${LABELS[temperature]}`}
    >
      {LABELS[temperature]}
    </span>
  );
}
