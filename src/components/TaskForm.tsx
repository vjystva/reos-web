"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OwnerCombobox } from "@/components/OwnerCombobox";
import { taskOwnerOptions, type TaskOwnerOption } from "@/lib/taskBoard";
import {
  CreateTaskRequestSchema,
  TASK_PRIORITIES,
  type CreateTaskRequest,
  type Task,
  type TaskPriority,
  type TaskResourceType,
} from "@/types/api";

interface TaskFormProps {
  /** When provided the form is in edit mode and pre-populates from this task. */
  initial?: Task | null;
  /** Owner options — falls back to a raw user-id input when empty/omitted. */
  users?: TaskOwnerOption[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateTaskRequest) => void;
  onCancel: () => void;
  submitLabel?: string;
}

const LABEL = "block text-xs font-medium text-foreground";
const FIELD_ERROR = "text-[11px] text-destructive";

type FieldErrors = Partial<Record<keyof CreateTaskRequest, string>>;

/**
 * `<input type="datetime-local">` produces values like "2026-05-17T14:30"
 * (no timezone). Convert to a full ISO string for the backend.
 */
function toIsoLocal(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toISOString();
}

function isoToInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskForm({
  initial,
  users,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  submitLabel,
}: TaskFormProps) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [description, setDescription] = React.useState(
    initial?.description ?? "",
  );
  const [priority, setPriority] = React.useState<TaskPriority>(
    (initial?.priority as TaskPriority) ?? "medium",
  );
  const [assignedTo, setAssignedTo] = React.useState(initial?.assignedTo ?? "");
  const [dueDate, setDueDate] = React.useState(
    isoToInputValue(initial?.dueDate),
  );
  const [resourceType, setResourceType] = React.useState<string>(
    (initial?.resourceType as string | null) ?? "",
  );
  const [resourceId, setResourceId] = React.useState(initial?.resourceId ?? "");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  // Only roles that can sensibly own a follow-up, sorted by display name, with
  // the already-assigned owner retained even if it fails the role filter.
  const ownerOptions = React.useMemo(
    () => taskOwnerOptions(users ?? [], assignedTo),
    [users, assignedTo],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw: Record<string, unknown> = {
      title: title.trim(),
      priority,
      assignedTo: assignedTo.trim(),
    };
    if (description.trim()) raw.description = description.trim();
    const due = toIsoLocal(dueDate);
    if (due) raw.dueDate = due;
    if (resourceType) {
      raw.resourceType = resourceType as TaskResourceType;
      if (resourceId.trim()) raw.resourceId = resourceId.trim();
    }

    const result = CreateTaskRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateTaskRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label className={LABEL} htmlFor="task-title">
          Title
        </label>
        <Input
          id="task-title"
          type="text"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Follow up with customer"
          required
        />
        {fieldErrors.title && (
          <p className={FIELD_ERROR}>{fieldErrors.title}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="task-description">
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="task-description"
          maxLength={2000}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Additional context"
        />
        {fieldErrors.description && (
          <p className={FIELD_ERROR}>{fieldErrors.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={LABEL} htmlFor="task-priority">
            Priority
          </label>
          <Select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </Select>
          {fieldErrors.priority && (
            <p className={FIELD_ERROR}>{fieldErrors.priority}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className={LABEL} htmlFor="task-assigned-to">
            Owner
          </label>
          {ownerOptions.length > 0 ? (
            <OwnerCombobox
              id="task-assigned-to"
              users={ownerOptions}
              value={assignedTo}
              onChange={setAssignedTo}
              placeholder="Search owners by name…"
              required
            />
          ) : (
            <Input
              id="task-assigned-to"
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="user-uuid"
              className="font-mono"
              required
            />
          )}
          {fieldErrors.assignedTo && (
            <p className={FIELD_ERROR}>{fieldErrors.assignedTo}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="task-due-date">
          Due date{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="task-due-date"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        {fieldErrors.dueDate && (
          <p className={FIELD_ERROR}>{fieldErrors.dueDate}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={LABEL} htmlFor="task-resource-type">
            Linked to{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Select
            id="task-resource-type"
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
          >
            <option value="">— None —</option>
            <option value="lead">Lead</option>
            <option value="booking">Booking</option>
            <option value="site_visit">Site visit</option>
          </Select>
          {fieldErrors.resourceType && (
            <p className={FIELD_ERROR}>{fieldErrors.resourceType}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className={LABEL} htmlFor="task-resource-id">
            Resource ID
          </label>
          <Input
            id="task-resource-id"
            type="text"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            placeholder={resourceType ? `${resourceType.replace("_", " ")} id` : "—"}
            className="font-mono"
            disabled={!resourceType}
          />
          {fieldErrors.resourceId && (
            <p className={FIELD_ERROR}>{fieldErrors.resourceId}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : (submitLabel ?? "Create task")}
        </Button>
      </div>
    </form>
  );
}
