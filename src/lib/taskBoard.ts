import type { StatusTone } from "@/components/StatusPill";
import { userLabel } from "@/components/nav-config";
import type { Task, TaskPriority, TaskStatus } from "@/types/api";

/**
 * Pure helpers backing the follow-ups board (`/dashboard/tasks`).
 *
 * Everything here is day-granular: a task is "due today" when its due date
 * falls inside the local calendar day, regardless of clock time. Bucketing is
 * done client-side over whatever page of tasks the API returned — see the
 * `loaded vs total` note on the page for the pagination caveat.
 */

export const TASK_PRIORITY_TONE: Record<TaskPriority, StatusTone> = {
  urgent: "bad",
  high: "warn",
  medium: "info",
  low: "neutral",
};

export const TASK_STATUS_TONE: Record<TaskStatus, StatusTone> = {
  open: "info",
  in_progress: "warn",
  completed: "good",
  cancelled: "neutral",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Structural shape shared by `User` and `TeamUser` — enough to render an
 * owner picker without coupling to either payload.
 */
export interface TaskOwnerOption {
  id: string;
  email: string;
  name?: string;
  /** `users.role` — absent when a caller builds options by hand. */
  role?: string;
}

/**
 * Roles that can sensibly own an internal follow-up.
 *
 * `dealer` and `customer` are deliberately excluded: an external channel
 * partner or a buyer is never the assignee of an internal task, and leaving
 * them in floods the picker (see `taskOwnerOptions`). `builder_admin`/`admin`
 * stay in because the signed-in admin is the default assignee on the tasks
 * page — dropping them would leave `defaultAssignee` pointing at an id that is
 * not in the list.
 */
export const TASK_OWNER_ROLES: readonly string[] = [
  "sales_agent",
  "sales_manager",
  "builder_admin",
  "admin",
];

/** Unknown/absent roles are kept — we can't judge, and hiding is worse. */
export function isTaskOwnerRole(role: string | null | undefined): boolean {
  if (role == null || role === "") return true;
  return TASK_OWNER_ROLES.includes(role);
}

/**
 * Human label for an owner.
 *
 * `users` has no `name` column (only `email`), so the display name is derived
 * from the email local-part with the same `userLabel` helper the sidebar uses:
 * `asha.rao@demo.com` → `Asha Rao`. An explicit `name` always wins if a future
 * payload supplies one.
 */
export function ownerLabel(u: TaskOwnerOption): string {
  const explicit = u.name?.trim();
  if (explicit) return explicit;
  if (!u.email) return u.id;
  const derived = userLabel(u.email);
  // `userLabel` yields the neutral "Signed in" for empty/uuid-shaped locals,
  // which is meaningless in a picker — show the raw email instead.
  return derived === "Signed in" ? u.email : derived;
}

/** Secondary line in the picker — always the real address, for disambiguation. */
export function ownerSubLabel(u: TaskOwnerOption): string {
  return u.email ?? "";
}

/**
 * Free-text match over the *derived name* and the email.
 *
 * Tokens are ANDed so "asha rao" and "rao asha" both hit, and typing a partial
 * name ("ash") narrows without needing the email.
 */
export function ownerMatches(u: TaskOwnerOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${ownerLabel(u)} ${u.email ?? ""}`.toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export function filterOwners(
  users: readonly TaskOwnerOption[],
  query: string,
): TaskOwnerOption[] {
  return users.filter((u) => ownerMatches(u, query));
}

/**
 * Picker-ready owner list: role-filtered and sorted by display name.
 *
 * `selectedId` is always retained even when it fails the role filter (a task
 * already assigned to a dealer, or to a since-deactivated account, must not be
 * silently dropped when the sheet opens).
 */
export function taskOwnerOptions(
  users: readonly TaskOwnerOption[],
  selectedId?: string | null,
): TaskOwnerOption[] {
  const out = users.filter((u) => isTaskOwnerRole(u.role));
  if (selectedId && !out.some((u) => u.id === selectedId)) {
    const kept = users.find((u) => u.id === selectedId);
    if (kept) out.push(kept);
  }
  return out.sort((a, b) =>
    ownerLabel(a).localeCompare(ownerLabel(b), undefined, {
      sensitivity: "base",
    }),
  );
}

/** Board columns, left to right, plus the closed bucket rendered underneath. */
export type TaskBucket = "overdue" | "today" | "upcoming" | "closed";

export const DAY_MS = 86_400_000;

export function isClosed(task: Task): boolean {
  return task.status === "completed" || task.status === "cancelled";
}

/** Epoch ms of the task due date, or `null` when absent/unparseable. */
export function dueTs(task: Task): number | null {
  if (!task.dueDate) return null;
  const t = new Date(task.dueDate).getTime();
  return Number.isNaN(t) ? null : t;
}

export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Which column a task belongs in.
 *
 * Open tasks with no due date land in `upcoming` — they'd otherwise vanish
 * from the board entirely, which is worse than showing them undated.
 */
export function taskBucket(task: Task, now: number): TaskBucket {
  if (isClosed(task)) return "closed";
  const ts = dueTs(task);
  if (ts == null) return "upcoming";
  if (ts < startOfDay(now)) return "overdue";
  if (ts <= endOfDay(now)) return "today";
  return "upcoming";
}

export interface BucketedTasks {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  closed: Task[];
}

/**
 * Split tasks into board columns. Open columns are sorted by due date
 * ascending (undated last); the closed bucket is sorted most-recently
 * completed first.
 */
export function bucketTasks(
  tasks: readonly Task[],
  now: number,
): BucketedTasks {
  const out: BucketedTasks = { overdue: [], today: [], upcoming: [], closed: [] };
  for (const task of tasks) out[taskBucket(task, now)].push(task);

  const byDueAsc = (a: Task, b: Task) => {
    const at = dueTs(a);
    const bt = dueTs(b);
    if (at == null && bt == null) return a.title.localeCompare(b.title);
    if (at == null) return 1;
    if (bt == null) return -1;
    return at - bt;
  };
  out.overdue.sort(byDueAsc);
  out.today.sort(byDueAsc);
  out.upcoming.sort(byDueAsc);

  out.closed.sort((a, b) => {
    const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bt - at;
  });

  return out;
}

/** Compact due token: "3d late" / "Today" / "Tomorrow" / "In 4d" / "12 Mar". */
export function dueLabel(
  iso: string | null | undefined,
  now: number,
): string {
  if (!iso) return "No date";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "No date";

  const diffDays = Math.floor((t - startOfDay(now)) / DAY_MS);
  if (diffDays < 0) return `${Math.abs(diffDays)}d late`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays}d`;

  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Full timestamp for `title=` tooltips. */
export function dueTitle(iso: string | null | undefined): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isOverdue(task: Task, now: number): boolean {
  return taskBucket(task, now) === "overdue";
}

/**
 * New ISO due date for a "+1d" / "+1w" snooze.
 *
 * Base is the current due date when it is still in the future, otherwise
 * `now` — snoozing an already-late task by a day should mean "tomorrow", not
 * "one day less late". Clock time of the base is preserved.
 *
 * This is expressed through the existing `PATCH /api/tasks/:id` dueDate field
 * — there is no dedicated snooze endpoint.
 */
export function snoozedDueDate(task: Task, days: number, now: number): string {
  const ts = dueTs(task);
  const base = ts != null && ts > now ? ts : now;
  return new Date(base + days * DAY_MS).toISOString();
}

/**
 * Deep link for a linked resource.
 *
 * `site_visit` has no per-visit route in this app, so it returns `null` and
 * the row renders a plain label instead of a dead link.
 */
export function taskResourceHref(task: Task): string | null {
  if (!task.resourceType || !task.resourceId) return null;
  const id = encodeURIComponent(task.resourceId);
  switch (task.resourceType) {
    case "lead":
      return `/dashboard/leads/${id}`;
    case "booking":
      return `/dashboard/bookings/${id}/payments`;
    default:
      return null;
  }
}

export function taskResourceLabel(task: Task): string | null {
  if (!task.resourceType) return null;
  switch (task.resourceType) {
    case "lead":
      return "Lead";
    case "booking":
      return "Booking";
    case "site_visit":
      return "Site visit";
    default:
      return String(task.resourceType);
  }
}

/**
 * `<input type="date">` gives "2026-08-03". Anchor it at local noon so the
 * calendar day survives the round-trip through UTC in either hemisphere.
 */
export function dateInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    12,
    0,
    0,
    0,
  );
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
