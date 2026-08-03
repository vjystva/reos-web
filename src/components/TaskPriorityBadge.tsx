import * as React from "react";
import { StatusPill } from "@/components/StatusPill";
import { TASK_PRIORITY_TONE } from "@/lib/taskBoard";
import type { TaskPriority } from "@/types/api";

const LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

interface TaskPriorityBadgeProps {
  priority: TaskPriority | string | undefined;
  className?: string;
}

/**
 * Priority chip for tasks — `StatusPill` geometry on the shared tone palette
 * (urgent = destructive, high = accent, medium = chart-2, low = muted).
 * The label is always rendered so colour is never the sole differentiator.
 */
export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  const key = (priority ?? "").toLowerCase() as TaskPriority;
  const tone = TASK_PRIORITY_TONE[key] ?? "neutral";
  const label = LABELS[key] ?? (priority ? String(priority) : "—");
  return (
    <StatusPill
      tone={tone}
      className={className}
      role="img"
      aria-label={`Priority: ${label}`}
    >
      {label}
    </StatusPill>
  );
}
