import * as React from "react";
import { cn } from "@/lib/utils";
import { LEAD_TEMPERATURE_CLASS, LEAD_TEMPERATURE_LABEL } from "@/lib/leadTone";
import type { LeadTemperature } from "@/types/api";

interface TemperatureBadgeProps {
  temperature: LeadTemperature;
  className?: string;
}

/**
 * Heat chip — same geometry as `StatusPill` but on the temperature palette
 * (see `@/lib/leadTone`): hot = chart-5, warm = chart-3, cold = muted.
 *
 * Text is always rendered so colour is never the sole differentiator
 * (WCAG SC 1.4.1).
 */
export function TemperatureBadge({
  temperature,
  className,
}: TemperatureBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none tracking-wide",
        LEAD_TEMPERATURE_CLASS[temperature],
        className,
      )}
      aria-label={`Temperature: ${LEAD_TEMPERATURE_LABEL[temperature]}`}
    >
      {LEAD_TEMPERATURE_LABEL[temperature]}
    </span>
  );
}
