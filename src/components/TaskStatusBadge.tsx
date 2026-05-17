import * as React from "react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/api";

const COLORS: Record<TaskStatus, string> = {
  open: "bg-blue-600 text-white",
  in_progress: "bg-amber-500 text-white",
  completed: "bg-green-700 text-white",
  cancelled: "bg-slate-500 text-white",
};

const LABELS: Record<TaskStatus, string> = {
  open: "OPEN",
  in_progress: "IN PROGRESS",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

interface TaskStatusBadgeProps {
  status: TaskStatus | string | undefined;
  className?: string;
}

/**
 * Status badge for tasks.
 * Colour + always-visible label so colour is never the sole differentiator.
 */
export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const key = (status ?? "").toLowerCase() as TaskStatus;
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
