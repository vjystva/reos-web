import * as React from "react";
import { StatusPill } from "@/components/StatusPill";
import { TASK_STATUS_LABEL, TASK_STATUS_TONE } from "@/lib/taskBoard";
import type { TaskStatus } from "@/types/api";

interface TaskStatusBadgeProps {
  status: TaskStatus | string | undefined;
  className?: string;
}

/**
 * Status chip for tasks — `StatusPill` geometry on the shared tone palette.
 * Colour + always-visible label so colour is never the sole differentiator.
 */
export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const key = (status ?? "").toLowerCase() as TaskStatus;
  const tone = TASK_STATUS_TONE[key] ?? "neutral";
  const label =
    TASK_STATUS_LABEL[key] ?? (status ? String(status).replace("_", " ") : "—");
  return (
    <StatusPill
      tone={tone}
      className={className}
      role="img"
      aria-label={`Status: ${label}`}
    >
      {label}
    </StatusPill>
  );
}
