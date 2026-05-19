import * as React from "react";
import { cn } from "@/lib/utils";

interface WorkflowStatusBadgeProps {
  isActive: boolean;
  className?: string;
}

/**
 * Status badge for workflows.
 * Active → green; inactive → slate. Label is always visible so colour
 * is never the sole differentiator.
 */
export function WorkflowStatusBadge({
  isActive,
  className,
}: WorkflowStatusBadgeProps) {
  const colour = isActive
    ? "bg-green-700 text-white"
    : "bg-slate-400 text-white";
  const label = isActive ? "ACTIVE" : "INACTIVE";
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

const EXEC_COLORS: Record<string, string> = {
  success: "bg-green-700 text-white",
  failed: "bg-red-700 text-white",
  partial: "bg-amber-500 text-white",
  running: "bg-blue-600 text-white",
};

interface WorkflowExecutionStatusBadgeProps {
  status: string | undefined;
  className?: string;
}

/**
 * Status pill for an individual workflow execution row.
 * success=green, failed=red, partial=amber, running=blue.
 */
export function WorkflowExecutionStatusBadge({
  status,
  className,
}: WorkflowExecutionStatusBadgeProps) {
  const key = (status ?? "").toLowerCase();
  const colour = EXEC_COLORS[key] ?? "bg-slate-300 text-slate-900";
  const label = status ? String(status).toUpperCase() : "—";
  return (
    <span
      role="img"
      aria-label={`Execution status: ${label}`}
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
