"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  dateInputToIso,
  ownerLabel,
  type TaskOwnerOption,
} from "@/lib/taskBoard";
import {
  CreateTaskRequestSchema,
  TASK_PRIORITIES,
  type CreateTaskRequest,
  type TaskPriority,
  type TaskResourceType,
} from "@/types/api";

interface TaskQuickAddProps {
  /** Owner options; falls back to a free-text user id when empty. */
  users: TaskOwnerOption[];
  /** Pre-selected owner — usually the signed-in user. */
  defaultAssignee?: string;
  isSubmitting: boolean;
  /** Resolves `true` when the task was created, which clears the row. */
  onSubmit: (data: CreateTaskRequest) => Promise<boolean>;
  /** Opens the full task sheet for description / advanced fields. */
  onMoreOptions?: () => void;
}

/**
 * Single-row task capture — title, due date, priority, owner, linked resource.
 *
 * Posts through the same `POST /api/tasks` contract as the full task sheet;
 * description and any field the row omits stay available via "More options".
 */
export function TaskQuickAdd({
  users,
  defaultAssignee,
  isSubmitting,
  onSubmit,
  onMoreOptions,
}: TaskQuickAddProps) {
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [priority, setPriority] = React.useState<TaskPriority>("medium");
  const [assignedTo, setAssignedTo] = React.useState(defaultAssignee ?? "");
  const [resourceType, setResourceType] = React.useState<string>("");
  const [resourceId, setResourceId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Adopt the signed-in user once it arrives, without clobbering a manual pick.
  const touchedOwner = React.useRef(false);
  React.useEffect(() => {
    if (!touchedOwner.current && defaultAssignee && !assignedTo) {
      setAssignedTo(defaultAssignee);
    }
  }, [defaultAssignee, assignedTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw: Record<string, unknown> = {
      title: title.trim(),
      priority,
      assignedTo: assignedTo.trim(),
    };
    const iso = dateInputToIso(dueDate);
    if (iso) raw.dueDate = iso;
    if (resourceType) {
      raw.resourceType = resourceType as TaskResourceType;
      if (resourceId.trim()) raw.resourceId = resourceId.trim();
    }

    const parsed = CreateTaskRequestSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the fields above");
      return;
    }
    setError(null);

    const ok = await onSubmit(parsed.data);
    if (ok) {
      setTitle("");
      setDueDate("");
      setPriority("medium");
      setResourceType("");
      setResourceId("");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add a follow-up"
      className="rounded-md border border-border bg-card p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="quick-title">
          Follow-up
        </label>
        <Input
          id="quick-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a follow-up…"
          className="min-w-[12rem] flex-1"
        />

        <label className="sr-only" htmlFor="quick-due">
          Due date
        </label>
        <Input
          id="quick-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-[9.5rem]"
        />

        <label className="sr-only" htmlFor="quick-priority">
          Priority
        </label>
        <Select
          id="quick-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="w-28"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </Select>

        <label className="sr-only" htmlFor="quick-owner">
          Owner
        </label>
        {users.length > 0 ? (
          <Select
            id="quick-owner"
            value={assignedTo}
            onChange={(e) => {
              touchedOwner.current = true;
              setAssignedTo(e.target.value);
            }}
            className="w-40"
          >
            <option value="">Owner…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {ownerLabel(u)}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            id="quick-owner"
            value={assignedTo}
            onChange={(e) => {
              touchedOwner.current = true;
              setAssignedTo(e.target.value);
            }}
            placeholder="Owner (user id)"
            className="w-40"
          />
        )}

        <label className="sr-only" htmlFor="quick-link">
          Link to
        </label>
        <Select
          id="quick-link"
          value={resourceType}
          onChange={(e) => {
            setResourceType(e.target.value);
            if (!e.target.value) setResourceId("");
          }}
          className="w-32"
        >
          <option value="">No link</option>
          <option value="lead">Lead</option>
          <option value="booking">Booking</option>
          <option value="site_visit">Site visit</option>
        </Select>

        {resourceType ? (
          <>
            <label className="sr-only" htmlFor="quick-link-id">
              Linked resource id
            </label>
            <Input
              id="quick-link-id"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              placeholder={`${resourceType.replace("_", " ")} id`}
              className="w-40 font-mono"
            />
          </>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          <Plus className="h-3 w-3" aria-hidden="true" />
          {isSubmitting ? "Adding…" : "Add"}
        </Button>

        {onMoreOptions ? (
          <Button type="button" variant="ghost" onClick={onMoreOptions}>
            More options
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 text-[11px] text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
