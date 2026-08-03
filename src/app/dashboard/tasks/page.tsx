"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { TaskPriorityBadge } from "@/components/TaskPriorityBadge";
import { TaskQuickAdd } from "@/components/TaskQuickAdd";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { useTasks } from "@/hooks/useTasks";
import { useTask } from "@/hooks/useTask";
import { useUsers } from "@/hooks/useUsers";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreateTaskMutation } from "@/hooks/useCreateTaskMutation";
import { useUpdateTaskMutation } from "@/hooks/useUpdateTaskMutation";
import { useCompleteTaskMutation } from "@/hooks/useCompleteTaskMutation";
import { useDeleteTaskMutation } from "@/hooks/useDeleteTaskMutation";
import {
  bucketTasks,
  dueTitle,
  ownerLabel,
  snoozedDueDate,
  taskResourceHref,
  taskResourceLabel,
  type BucketedTasks,
} from "@/lib/taskBoard";
import { formatDate } from "@/lib/utils";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type CreateTaskRequest,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/types/api";

/**
 * Board is bucketed client-side, so the tiles only ever describe the page of
 * tasks the API actually returned. Ask for a big page and surface the gap in
 * the header when the tenant has more than that.
 */
const PAGE_LIMIT = 100; // backend ListTasksDto caps `limit` at 100 — 200 400s

type SheetMode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; task: Task };

type ColumnTone = "bad" | "warn" | "neutral";

const RAIL: Record<ColumnTone, string> = {
  bad: "bg-destructive",
  warn: "bg-accent",
  neutral: "bg-muted-foreground/30",
};

const COUNT_TEXT: Record<ColumnTone, string> = {
  bad: "text-destructive",
  warn: "text-accent-foreground",
  neutral: "text-foreground",
};

/* -------------------------------------------------------------------------
 * Board column
 * ---------------------------------------------------------------------- */

interface BoardColumnProps {
  title: string;
  tone: ColumnTone;
  tasks: Task[];
  emptyLabel: string;
  isLoading?: boolean;
  now: number;
  assigneeLabel: (id: string | null | undefined) => string | null;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSnooze: (task: Task, days: number) => void;
  completingId: string | null;
  deletingId: string | null;
  snoozingId: string | null;
}

function BoardColumn({
  title,
  tone,
  tasks,
  emptyLabel,
  isLoading,
  now,
  assigneeLabel,
  onComplete,
  onEdit,
  onDelete,
  onSnooze,
  completingId,
  deletingId,
  snoozingId,
}: BoardColumnProps) {
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <div className={`h-0.5 shrink-0 ${RAIL[tone]}`} aria-hidden="true" />
      <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
        <h2 className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span
          className={`font-mono text-[11px] font-semibold tabular-nums ${COUNT_TEXT[tone]}`}
        >
          {tasks.length}
        </span>
      </div>
      <CardContent className="p-1.5">
        {isLoading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-14 w-full rounded-sm" />
            <Skeleton className="h-14 w-full rounded-sm" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="py-8 text-center text-[11px] text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <ul role="list" className="space-y-1.5">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                now={now}
                assigneeLabel={assigneeLabel(task.assignedTo)}
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onSnooze={onSnooze}
                completingId={completingId}
                deletingId={deletingId}
                snoozingId={snoozingId}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------
 * Completed / cancelled disclosure
 * ---------------------------------------------------------------------- */

function CompletedSection({
  tasks,
  onDelete,
  deletingId,
}: {
  tasks: Task[];
  onDelete: (task: Task) => void;
  deletingId: string | null;
}) {
  return (
    <details className="group rounded-md border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background">
        <ChevronRight
          className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        Completed
        <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
          {tasks.length}
        </span>
      </summary>

      {tasks.length === 0 ? (
        <p className="px-3 pb-3 text-[11px] text-muted-foreground">
          Nothing closed out in the tasks loaded.
        </p>
      ) : (
        <Table wrapperClassName="rounded-none border-0 border-t border-border">
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Linked to</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Closed</TableHead>
              <TableHead className="w-8">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const href = taskResourceHref(task);
              const label = taskResourceLabel(task);
              return (
                <TableRow key={task.id}>
                  <TableCell className="max-w-[24rem] truncate text-muted-foreground line-through">
                    {task.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {label ? (
                      href ? (
                        <Link href={href} className="text-primary hover:underline">
                          {label} {task.resourceId}
                        </Link>
                      ) : (
                        `${label} ${task.resourceId ?? ""}`
                      )
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <TaskPriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap font-mono tabular-nums text-muted-foreground"
                    title={dueTitle(task.completedAt)}
                  >
                    {task.completedAt ? formatDate(task.completedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onDelete(task)}
                      disabled={deletingId === task.id}
                      aria-label={`Delete "${task.title}"`}
                      title="Delete task"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </details>
  );
}

/* -------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

function TasksContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = React.useState<TaskPriority | "">("");
  const [ownerFilter, setOwnerFilter] = React.useState<string>("");
  const [sheet, setSheet] = React.useState<SheetMode>({ kind: "closed" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [completingId, setCompletingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [snoozingId, setSnoozingId] = React.useState<string | null>(null);

  const tasksQuery = useTasks({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    assignedTo: ownerFilter || undefined,
    limit: PAGE_LIMIT,
  });
  const usersQuery = useUsers();
  const meQuery = useCurrentUser();

  const createMutation = useCreateTaskMutation();
  const updateMutation = useUpdateTaskMutation();
  const completeMutation = useCompleteTaskMutation();
  const deleteMutation = useDeleteTaskMutation();

  const users = React.useMemo(() => usersQuery.data?.data ?? [], [usersQuery.data]);
  const ownerById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, ownerLabel(u));
    return map;
  }, [users]);
  const assigneeLabel = React.useCallback(
    (id: string | null | undefined) => (id ? (ownerById.get(id) ?? null) : null),
    [ownerById],
  );

  const myUserId = React.useMemo(() => {
    const email = meQuery.data?.email;
    if (!email) return undefined;
    return users.find((u) => u.email === email)?.id;
  }, [meQuery.data?.email, users]);

  /* --- deep link: /dashboard/tasks?taskId=… opens that task for editing --- */
  const deepLinkId = params.get("taskId");
  const deepLinkQuery = useTask(deepLinkId);
  const openedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    const task = deepLinkQuery.data;
    if (!deepLinkId || !task || openedFor.current === deepLinkId) return;
    openedFor.current = deepLinkId;
    setSheet({ kind: "edit", task });
  }, [deepLinkId, deepLinkQuery.data]);

  function closeSheet() {
    setSheet({ kind: "closed" });
    setFormError(null);
    if (params.get("taskId")) {
      const next = new URLSearchParams(params.toString());
      next.delete("taskId");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  }

  async function handleCreate(data: CreateTaskRequest): Promise<boolean> {
    setFormError(null);
    setActionError(null);
    try {
      await createMutation.mutateAsync(data);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create task";
      setFormError(msg);
      setActionError(msg);
      return false;
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
    setActionError(null);
    setCompletingId(task.id);
    try {
      await completeMutation.mutateAsync({ taskId: task.id });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to complete task",
      );
    } finally {
      setCompletingId(null);
    }
  }

  /**
   * Snooze re-uses `PATCH /api/tasks/:id` with a pushed-out `dueDate` — the
   * API has no dedicated snooze endpoint.
   */
  async function handleSnooze(task: Task, days: number) {
    setActionError(null);
    setSnoozingId(task.id);
    try {
      await updateMutation.mutateAsync({
        taskId: task.id,
        body: { dueDate: snoozedDueDate(task, days, Date.now()) },
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to reschedule task",
      );
    } finally {
      setSnoozingId(null);
    }
  }

  async function handleDelete(task: Task) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete task "${task.title}"?`)
    ) {
      return;
    }
    setActionError(null);
    setDeletingId(task.id);
    try {
      await deleteMutation.mutateAsync({ taskId: task.id });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  }

  const tasks = React.useMemo(() => tasksQuery.data?.data ?? [], [tasksQuery.data]);

  // One clock for the whole board, refreshed whenever the query refetches.
  const now = React.useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasksQuery.dataUpdatedAt],
  );

  const buckets: BucketedTasks = React.useMemo(
    () => bucketTasks(tasks, now),
    [tasks, now],
  );

  const total = tasksQuery.data?.total ?? tasks.length;
  const truncated = total > tasks.length;
  const filtered = Boolean(statusFilter || priorityFilter || ownerFilter);
  const isLoading = tasksQuery.isLoading;

  const countHint = truncated
    ? `of ${tasks.length} loaded`
    : filtered
      ? "within filters"
      : undefined;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Follow-ups"
        subtitle={
          truncated
            ? `${tasks.length} of ${total} tasks loaded — counts cover the loaded page only`
            : `${total} task${total === 1 ? "" : "s"}`
        }
        actions={
          <>
            <PollIndicator
              isFetching={tasksQuery.isFetching}
              isError={tasksQuery.isError}
              dataUpdatedAt={tasksQuery.dataUpdatedAt}
              onRetry={() => tasksQuery.refetch()}
            />
            <Button
              onClick={() => {
                setFormError(null);
                setSheet({ kind: "create" });
              }}
            >
              New task
            </Button>
          </>
        }
      />

      <section
        aria-label="Follow-up counts"
        className="grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        <MetricCard
          label="Overdue"
          value={isLoading ? null : buckets.overdue.length}
          isLoading={isLoading}
          isError={tasksQuery.isError}
          hint={countHint}
          className={buckets.overdue.length > 0 ? "border-destructive/40" : undefined}
        />
        <MetricCard
          label="Due today"
          value={isLoading ? null : buckets.today.length}
          isLoading={isLoading}
          isError={tasksQuery.isError}
          hint={countHint}
        />
        <MetricCard
          label="Upcoming"
          value={isLoading ? null : buckets.upcoming.length}
          isLoading={isLoading}
          isError={tasksQuery.isError}
          hint={countHint}
        />
        <MetricCard
          label="Completed"
          value={
            isLoading
              ? null
              : buckets.closed.filter((t) => t.status === "completed").length
          }
          isLoading={isLoading}
          isError={tasksQuery.isError}
          hint={countHint}
        />
      </section>

      <TaskQuickAdd
        users={users}
        defaultAssignee={myUserId}
        isSubmitting={createMutation.isPending}
        onSubmit={handleCreate}
        onMoreOptions={() => {
          setFormError(null);
          setSheet({ kind: "create" });
        }}
      />

      <section
        aria-label="Filters"
        className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
      >
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Filter
        </span>
        <label className="sr-only" htmlFor="filter-owner">
          Owner
        </label>
        <Select
          id="filter-owner"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All owners</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {ownerLabel(u)}
            </option>
          ))}
        </Select>

        <label className="sr-only" htmlFor="filter-status">
          Status
        </label>
        <Select
          id="filter-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
          className="w-36"
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>

        <label className="sr-only" htmlFor="filter-priority">
          Priority
        </label>
        <Select
          id="filter-priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "")}
          className="w-32"
        >
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>

        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("");
              setPriorityFilter("");
              setOwnerFilter("");
            }}
          >
            Clear
          </Button>
        ) : null}
      </section>

      {actionError ? (
        <ErrorBanner
          message={actionError}
          retryLabel="Dismiss"
          onRetry={() => setActionError(null)}
        />
      ) : null}

      {tasksQuery.isError ? (
        <ErrorBanner
          message="Failed to load tasks."
          onRetry={() => tasksQuery.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <BoardColumn
              title="Overdue"
              tone="bad"
              tasks={buckets.overdue}
              emptyLabel="Nothing overdue"
              isLoading={isLoading}
              now={now}
              assigneeLabel={assigneeLabel}
              onComplete={handleComplete}
              onEdit={(t) => setSheet({ kind: "edit", task: t })}
              onDelete={handleDelete}
              onSnooze={handleSnooze}
              completingId={completingId}
              deletingId={deletingId}
              snoozingId={snoozingId}
            />
            <BoardColumn
              title="Due today"
              tone="warn"
              tasks={buckets.today}
              emptyLabel="Nothing due today"
              isLoading={isLoading}
              now={now}
              assigneeLabel={assigneeLabel}
              onComplete={handleComplete}
              onEdit={(t) => setSheet({ kind: "edit", task: t })}
              onDelete={handleDelete}
              onSnooze={handleSnooze}
              completingId={completingId}
              deletingId={deletingId}
              snoozingId={snoozingId}
            />
            <BoardColumn
              title="Upcoming"
              tone="neutral"
              tasks={buckets.upcoming}
              emptyLabel="Nothing scheduled"
              isLoading={isLoading}
              now={now}
              assigneeLabel={assigneeLabel}
              onComplete={handleComplete}
              onEdit={(t) => setSheet({ kind: "edit", task: t })}
              onDelete={handleDelete}
              onSnooze={handleSnooze}
              completingId={completingId}
              deletingId={deletingId}
              snoozingId={snoozingId}
            />
          </div>

          <CompletedSection
            tasks={buckets.closed}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        </>
      )}

      <Sheet
        open={sheet.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-md">
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
            <div className="mt-2">
              <TaskForm
                initial={sheet.kind === "edit" ? sheet.task : null}
                users={users}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
                error={formError}
                onCancel={closeSheet}
                submitLabel={sheet.kind === "edit" ? "Save changes" : "Create task"}
                onSubmit={(data) => {
                  if (sheet.kind === "edit") {
                    void handleUpdate(sheet.task.id, data);
                  } else {
                    void handleCreate(data).then((ok) => {
                      if (ok) closeSheet();
                    });
                  }
                }}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <TasksContent />
    </Suspense>
  );
}
