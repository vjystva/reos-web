"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { SkeletonCard } from "@/components/SkeletonCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { useTasks } from "@/hooks/useTasks";
import { useCreateTaskMutation } from "@/hooks/useCreateTaskMutation";
import { useUpdateTaskMutation } from "@/hooks/useUpdateTaskMutation";
import { useCompleteTaskMutation } from "@/hooks/useCompleteTaskMutation";
import { useDeleteTaskMutation } from "@/hooks/useDeleteTaskMutation";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type CreateTaskRequest,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/types/api";

type SheetMode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; task: Task };

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = React.useState<TaskPriority | "">("");
  const [sheet, setSheet] = React.useState<SheetMode>({ kind: "closed" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [completingId, setCompletingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const tasksQuery = useTasks({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
  });

  const createMutation = useCreateTaskMutation();
  const updateMutation = useUpdateTaskMutation();
  const completeMutation = useCompleteTaskMutation();
  const deleteMutation = useDeleteTaskMutation();

  function closeSheet() {
    setSheet({ kind: "closed" });
    setFormError(null);
  }

  async function handleCreate(data: CreateTaskRequest) {
    setFormError(null);
    try {
      await createMutation.mutateAsync(data);
      closeSheet();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  async function handleUpdate(taskId: string, data: CreateTaskRequest) {
    setFormError(null);
    try {
      await updateMutation.mutateAsync({ taskId, body: data });
      closeSheet();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  async function handleComplete(task: Task) {
    setCompletingId(task.id);
    try {
      await completeMutation.mutateAsync({ taskId: task.id });
    } catch {
      // surfaced by query refetch / could be logged
    } finally {
      setCompletingId(null);
    }
  }

  async function handleDelete(task: Task) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete task "${task.title}"?`)
    ) {
      return;
    }
    setDeletingId(task.id);
    try {
      await deleteMutation.mutateAsync({ taskId: task.id });
    } catch {
      // intentionally swallowed; refetch shows truth
    } finally {
      setDeletingId(null);
    }
  }

  const tasks = tasksQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500">
            Track follow-ups, internal work, and customer commitments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PollIndicator
            isFetching={tasksQuery.isFetching}
            isError={tasksQuery.isError}
            dataUpdatedAt={tasksQuery.dataUpdatedAt}
            onRetry={() => tasksQuery.refetch()}
          />
          <Button onClick={() => setSheet({ kind: "create" })}>New task</Button>
        </div>
      </header>

      <section className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700" htmlFor="filter-status">
            Status
          </label>
          <Select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
            className="w-40"
          >
            <option value="">All</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700" htmlFor="filter-priority">
            Priority
          </label>
          <Select
            id="filter-priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "")}
            className="w-40"
          >
            <option value="">All</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {tasksQuery.isError ? (
        <ErrorBanner
          message="Failed to load tasks."
          onRetry={() => tasksQuery.refetch()}
        />
      ) : tasksQuery.isLoading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
          No tasks match these filters. Create one to get started.
        </div>
      ) : (
        <ul role="list" className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleComplete}
              onEdit={(t) => setSheet({ kind: "edit", task: t })}
              onDelete={handleDelete}
              completingId={completingId}
              deletingId={deletingId}
            />
          ))}
        </ul>
      )}

      <Sheet
        open={sheet.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {sheet.kind === "edit" ? "Edit task" : "New task"}
            </SheetTitle>
            <SheetDescription>
              {sheet.kind === "edit"
                ? "Update the task details below."
                : "Fill in the details and click Create task."}
            </SheetDescription>
          </SheetHeader>

          {sheet.kind !== "closed" ? (
            <TaskForm
              initial={sheet.kind === "edit" ? sheet.task : null}
              isSubmitting={
                createMutation.isPending || updateMutation.isPending
              }
              error={formError}
              onCancel={closeSheet}
              submitLabel={sheet.kind === "edit" ? "Save changes" : "Create task"}
              onSubmit={(data) => {
                if (sheet.kind === "edit") {
                  void handleUpdate(sheet.task.id, data);
                } else {
                  void handleCreate(data);
                }
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
