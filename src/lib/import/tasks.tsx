/**
 * Tasks import config.
 *
 * Backend: `POST /tasks/import/csv`
 * (`@Roles('builder_admin','sales_manager','sales_agent','dealer')`) via BFF
 * `POST /api/tasks/import`.
 *
 * `assigned_to_email` deserves care: BLANK creates an unassigned task (fully
 * supported), but a NON-BLANK email that does not resolve to an active user in
 * the tenant REJECTS the row. That is intentional backend behaviour — silently
 * dropping a typo'd assignee would hide the mistake — so the UI must not
 * present it as ignorable.
 *
 * Tasks have no natural unique key (two "Call the client" tasks are perfectly
 * valid), so this config declares no `dedupe` and the screen hides the
 * Duplicates tile entirely rather than showing a permanent zero.
 *
 * `resource_type` / `resource_id` are not part of the CSV surface — they are a
 * both-or-neither pair pointing at a UUID nobody has in a spreadsheet.
 */

import type { EntityImportConfig } from "./types";
import { isoDateCell, maxLenCell } from "./validators";

/** `TASK_PRIORITIES` in reos-backend/src/tasks/tasks.constants.ts. */
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const tasksImportConfig: EntityImportConfig = {
  key: "tasks",
  label: "Tasks",
  noun: { one: "task", many: "tasks" },
  description:
    "Creates follow-up tasks. Leave the assignee blank for an unassigned task — a typo'd email rejects the row.",
  fields: [
    {
      key: "title",
      label: "Title",
      required: true,
      aliases: ["task", "task title", "subject", "summary"],
      validate: maxLenCell("Title", 500),
    },
    {
      key: "description",
      label: "Description",
      required: false,
      aliases: ["details", "notes", "body"],
      validate: maxLenCell("Description", 5000),
    },
    {
      key: "priority",
      label: "Priority",
      required: false,
      hint: "Blank defaults to medium",
      aliases: ["urgency", "importance"],
      validate: (v) =>
        TASK_PRIORITIES.some((p) => p === v.toLowerCase())
          ? null
          : `Priority must be one of ${TASK_PRIORITIES.join(" | ")}`,
    },
    {
      key: "due_date",
      label: "Due date",
      required: false,
      hint: "ISO date or datetime, e.g. 2026-03-31",
      aliases: ["due", "deadline", "due on", "target date"],
      validate: isoDateCell("Due date"),
    },
    {
      key: "assigned_to_email",
      label: "Assignee email",
      required: false,
      hint: "Blank leaves the task unassigned · an unknown email rejects the row",
      aliases: ["assignee", "assigned to", "owner email", "owner"],
      // Deliberately NOT `emailCell`: the backend also rejects a well-formed
      // address that matches no active user, so a green preview here would be
      // misleading either way. Shape is still worth catching early.
      validate: (v) =>
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
          ? null
          : "Assignee email is not a valid email",
    },
  ],
  sampleCsv: [
    "Task Title,Details,Urgency,Due,Assignee",
    "Call back about floor plan,Wants the 3BHK east-facing layout,high,2026-09-15,",
    "Send RERA certificate,Requested during the site visit,medium,2026-09-18,",
    "Schedule second site visit,Prefers weekend slots,low,2026-09-25,",
    // Deliberately invalid: due date is not parseable.
    "Follow up on payment,Cheque bounced,urgent,next tuesday,",
  ].join("\n"),
  sampleFileName: "sample-tasks.csv",
  uploadFileName: "tasks.csv",
  placeholder:
    "title,description,priority,due_date,assigned_to_email\nCall back about floor plan,Wants the 3BHK,high,2026-09-15,",
  endpoint: () => "/api/tasks/import",
  invalidateKeys: ["tasks", "metrics"],
  previewColumns: () => [
    {
      header: "Title",
      className: "font-medium text-foreground",
      render: (row) => row.values.title || "—",
    },
    {
      header: "Description",
      className: "text-muted-foreground",
      render: (row) => row.values.description || "—",
    },
    {
      header: "Priority",
      className: "text-muted-foreground",
      render: (row) => row.values.priority || "medium",
    },
    {
      header: "Due",
      className: "whitespace-nowrap text-muted-foreground",
      render: (row) => row.values.due_date || "—",
    },
    {
      header: "Assignee",
      className: "text-muted-foreground",
      render: (row) => row.values.assigned_to_email || "unassigned",
    },
  ],
  previewNote: (
    <>
      A blank assignee is valid and creates an unassigned task. A non-blank
      address that matches no active user in this tenant rejects that row —
      it is not silently ignored.
    </>
  ),
  resultNote: () => (
    <>
      Imported tasks start at status <code>pending</code>; a blank priority is
      stored as <code>medium</code>.
    </>
  ),
};
