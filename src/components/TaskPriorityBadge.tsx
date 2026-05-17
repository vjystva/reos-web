import * as React from "react";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types/api";

const COLORS: Record<TaskPriority, string> = {
  low: "bg-slate-500 text-white",
  medium: "bg-blue-600 text-white",
  high: "bg-amber-500 text-white",
  urgent: "bg-red-600 text-white",
};

const LABELS: Record<TaskPriority, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
};

interface TaskPriorityBadgeProps {
  priority: TaskPriority | string | undefined;
  className?: string;
}

/**
 * Priority badge for tasks.
 */
export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  const key = (priority ?? "").toLowerCase() as TaskPriority;
  const colour = COLORS[key] ?? "bg-slate-300 text-slate-900";
  const label = LABELS[key] ?? (priority ? String(priority).toUpperCase() : "—");
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
