"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { TaskPriorityBadge } from "@/components/TaskPriorityBadge";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { cn } from "@/lib/utils";
import {
  dueLabel,
  dueTitle,
  isOverdue,
  taskResourceHref,
  taskResourceLabel,
} from "@/lib/taskBoard";
import type { Task } from "@/types/api";

interface TaskCardProps {
  task: Task;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** Push the due date out by N days via the task update endpoint. */
  onSnooze?: (task: Task, days: number) => void;
  completingId?: string | null;
  deletingId?: string | null;
  snoozingId?: string | null;
  /** Resolved display name for `task.assignedTo` (raw id is unreadable). */
  assigneeLabel?: string | null;
  /** Injected so a whole board renders against one clock. */
  now?: number;
  className?: string;
}

const ICON_BTN =
  "inline-flex h-6 w-6 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40";

const SNOOZE_BTN =
  "inline-flex h-6 items-center rounded-sm border border-border px-1.5 font-mono text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40";

/**
 * One row on the follow-ups board: complete checkbox, title (+ deep link to
 * the linked lead/booking), priority chip, due token, and the snooze / edit /
 * delete affordances. Actions stay muted until hover or keyboard focus so a
 * dense column reads as a list, not a toolbar grid.
 */
export function TaskCard({
  task,
  onComplete,
  onEdit,
  onDelete,
  onSnooze,
  completingId,
  deletingId,
  snoozingId,
  assigneeLabel,
  now,
  className,
}: TaskCardProps) {
  const clock = now ?? Date.now();
  const closed = task.status === "completed" || task.status === "cancelled";
  const canComplete = !closed;
  const canEdit = !closed;
  const isCompleting = completingId === task.id;
  const isDeleting = deletingId === task.id;
  const isSnoozing = snoozingId === task.id;
  const overdue = isOverdue(task, clock);

  const href = taskResourceHref(task);
  const resourceLabel = taskResourceLabel(task);

  return (
    <li
      className={cn(
        "group rounded-sm border border-border bg-card px-2 py-1.5 transition-colors hover:border-primary/40",
        isCompleting && "opacity-60",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={task.status === "completed"}
          disabled={!canComplete || isCompleting}
          onChange={() => onComplete(task)}
          aria-label={`Mark "${task.title}" complete`}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "min-w-0 break-words text-xs font-medium text-foreground",
                closed && "line-through decoration-muted-foreground",
              )}
            >
              {task.title}
            </span>
            <span
              title={dueTitle(task.dueDate)}
              className={cn(
                "shrink-0 font-mono text-[11px] tabular-nums",
                overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {dueLabel(task.dueDate, clock)}
            </span>
          </div>

          {task.description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
              {task.description}
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <TaskPriorityBadge priority={task.priority} />
            {task.status !== "open" ? (
              <TaskStatusBadge status={task.status} />
            ) : null}

            {resourceLabel ? (
              href ? (
                <Link
                  href={href}
                  className="inline-flex max-w-[12rem] items-center gap-0.5 truncate text-[11px] text-primary hover:underline"
                  title={`${resourceLabel} ${task.resourceId}`}
                >
                  <span className="truncate">
                    {resourceLabel} {task.resourceId}
                  </span>
                  <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                </Link>
              ) : (
                <span
                  className="max-w-[12rem] truncate text-[11px] text-muted-foreground"
                  title={`${resourceLabel} ${task.resourceId ?? ""}`}
                >
                  {resourceLabel} {task.resourceId ?? ""}
                </span>
              )
            ) : null}

            {assigneeLabel ? (
              <span
                className="max-w-[10rem] truncate text-[11px] text-muted-foreground"
                title={`Owner: ${assigneeLabel}`}
              >
                {assigneeLabel}
              </span>
            ) : null}

            <span className="ml-auto flex items-center gap-1 opacity-100 transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              {onSnooze && canComplete ? (
                <>
                  <button
                    type="button"
                    className={SNOOZE_BTN}
                    disabled={isSnoozing}
                    onClick={() => onSnooze(task, 1)}
                    title="Push the due date out by one day"
                    aria-label={`Snooze "${task.title}" by one day`}
                  >
                    +1d
                  </button>
                  <button
                    type="button"
                    className={SNOOZE_BTN}
                    disabled={isSnoozing}
                    onClick={() => onSnooze(task, 7)}
                    title="Push the due date out by one week"
                    aria-label={`Snooze "${task.title}" by one week`}
                  >
                    +1w
                  </button>
                </>
              ) : null}

              {canEdit ? (
                <button
                  type="button"
                  className={ICON_BTN}
                  onClick={() => onEdit(task)}
                  title="Edit task"
                  aria-label={`Edit "${task.title}"`}
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                </button>
              ) : null}

              <button
                type="button"
                className={cn(ICON_BTN, "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive")}
                disabled={isDeleting}
                onClick={() => onDelete(task)}
                title="Delete task"
                aria-label={`Delete "${task.title}"`}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
