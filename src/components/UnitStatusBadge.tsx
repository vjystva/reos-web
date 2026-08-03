import * as React from "react";
import { StatusPill } from "@/components/StatusPill";
import {
  unitStatusEmphasis,
  unitStatusLabel,
  unitStatusTone,
} from "@/lib/unitTone";
import { cn } from "@/lib/utils";

interface UnitStatusBadgeProps {
  status: string | undefined;
  className?: string;
}

/**
 * Unit status chip — thin wrapper over `StatusPill` so every unit surface
 * (grid tile, table row, slide-over) reads the same tone language defined in
 * `lib/unitTone.ts`. Covers all 8 backend UNIT_STATUSES.
 *
 * The text label is always visible (WCAG: colour is never the sole
 * differentiator) and `role="img"` keeps it a static label rather than a live
 * region.
 */
export function UnitStatusBadge({ status, className }: UnitStatusBadgeProps) {
  const label = unitStatusLabel(status);
  return (
    <StatusPill
      role="img"
      aria-label={`Status: ${label}`}
      tone={unitStatusTone(status)}
      className={cn(unitStatusEmphasis(status), className)}
    >
      {label}
    </StatusPill>
  );
}
