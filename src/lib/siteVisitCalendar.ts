/**
 * Pure date helpers for the Monday-first month grid used by the site-visit
 * calendar. No calendar library is installed (deliberately) — this is the
 * whole of the date maths, kept side-effect free so it is unit-testable.
 *
 * All functions operate in the browser's local timezone: a visit scheduled at
 * 2026-03-12T18:30:00Z must land on the cell the user reads as 13 March if
 * that is their local date.
 */

export const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

/** Number of cells in the grid — 6 weeks, always, so the grid never reflows. */
export const GRID_CELLS = 42;

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** 0 = Monday … 6 = Sunday (JS getDay() is 0 = Sunday). */
export function mondayFirstIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Local `YYYY-MM-DD` — the grouping key for a day cell. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/**
 * 42 consecutive dates starting on the Monday on/before the 1st of `anchor`'s
 * month. Leading/trailing cells belong to the adjacent months.
 */
export function buildMonthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const gridStart = addDays(first, -mondayFirstIndex(first));
  return Array.from({ length: GRID_CELLS }, (_, i) => addDays(gridStart, i));
}

/**
 * Inclusive ISO range covering every cell in the grid — what we ask the API
 * for, so the leading/trailing days of adjacent months are populated too.
 */
export function gridRange(anchor: Date): { from: string; to: string } {
  const cells = buildMonthGrid(anchor);
  const from = startOfDay(cells[0]);
  const to = new Date(cells[cells.length - 1]);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function monthLabel(anchor: Date): string {
  return anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** Groups anything with a date field into local-day buckets. */
export function groupByDay<T>(
  items: readonly T[],
  getDate: (item: T) => string | Date | null | undefined,
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const raw = getDate(item);
    if (raw == null) continue;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(d);
    const bucket = out.get(key);
    if (bucket) bucket.push(item);
    else out.set(key, [item]);
  }
  return out;
}

/** "6:30 pm" — the time prefix shown on a chip and in the side lists. */
export function timeLabel(iso: string | Date | null | undefined): string {
  if (iso == null) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
