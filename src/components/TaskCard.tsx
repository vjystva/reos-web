"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { TaskPriorityBadge } from "@/components/TaskPriorityBadge";
import type { Task } from "@/types/api";

interface TaskCardProps {
  task: Task;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  completingId?: string | null;
  deletingId?: string | null;
}

function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return "No due date";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TaskCard({
  task,
  onComplete,
  onEdit,
  onDelete,
  completingId,
  deletingId,
}: TaskCardProps) {
  const canComplete = task.status !== "completed" && task.status !== "cancelled";
  const canEdit = task.status !== "completed" && task.status !== "cancelled";
  const isCompleting = completingId === task.id;
  const isDeleting = deletingId === task.id;

  return (
    <li
      className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
      role="listitem"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 break-words">
            {task.title}
          </h3>
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>
        {task.description ? (
          <p className="text-xs text-slate-600 break-words">{task.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            Assigned:{" "}
            <span className="font-mono">{task.assignedTo ?? "—"}</span>
          </span>
          <span>Due: {formatDueDate(task.dueDate)}</span>
          {task.resourceType && task.resourceId ? (
            <span>
              {task.resourceType}:{" "}
              <span className="font-mono">{task.resourceId}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canComplete ? (
          <Button
            size="sm"
            variant="default"
            onClick={() => onComplete(task)}
            disabled={isCompleting}
          >
            {isCompleting ? "Completing…" : "Complete"}
          </Button>
        ) : null}
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={() => onEdit(task)}>
            Edit
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDelete(task)}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </li>
  );
}
