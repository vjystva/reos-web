import type { TeamUser, TenantSiteVisit } from "@/types/api";

/**
 * Shared sales-rep performance model.
 *
 * Feeds two screens that show the same numbers from different angles:
 *   - /dashboard/team           — the roster view (one row per team member)
 *   - /dashboard/reports        — the "Sales owner performance" panel
 *
 * Data provenance (all figures below are read from real endpoints — nothing
 * is synthesised):
 *   - quota / achieved / bookings → `GET /api/sales-targets` (sales_targets
 *     table: target_revenue, actual_revenue, actual_bookings)
 *   - site visits                → `GET /api/site-visits/calendar`, bucketed
 *     by `assignedAgentId`
 *
 * KNOWN GAP — per-rep *lead* counts are deliberately absent. `GET /leads`
 * returns `assignedDealerId` (the channel partner), not the sales owner, and
 * the BFF's `LeadSchema` does not carry a sales-owner field at all. Rather
 * than attribute leads to the wrong actor, both screens omit the column and
 * say so in the UI.
 */

export interface SalesTarget {
  id: string;
  assigneeId: string;
  period: string;
  periodStart: string;
  targetBookings?: number;
  /** node-pg returns numeric columns as strings. */
  targetRevenue?: string | number;
  actualBookings?: number;
  actualRevenue?: string | number;
}

export interface FetchSalesTargetsParams {
  assigneeId?: string;
  period?: string;
}

/**
 * `GET /api/sales-targets` — the BFF normalises a bare array into
 * `{ data, total }`. Kept here (not in `src/hooks/`) so both the team page
 * and the reports page can share one query function.
 */
export async function fetchSalesTargets(
  params: FetchSalesTargetsParams = {},
): Promise<SalesTarget[]> {
  const qs = new URLSearchParams();
  if (params.assigneeId) qs.set("assigneeId", params.assigneeId);
  if (params.period) qs.set("period", params.period);

  const url = qs.toString()
    ? `/api/sales-targets?${qs.toString()}`
    : "/api/sales-targets";

  const res = await fetch(url);
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`sales_targets_fetch_failed_${res.status}`);

  const json = (await res.json()) as { data?: SalesTarget[] } | SalesTarget[];
  if (Array.isArray(json)) return json;
  return json.data ?? [];
}

/** numeric(…) columns arrive as strings — coerce, never NaN. */
export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** `null` when there is no quota to measure against (avoids a fake 0%). */
export function achievementPct(
  achieved: number,
  target: number,
): number | null {
  if (target <= 0) return null;
  return Math.round((achieved / target) * 100);
}

/** "priya.shah@acme.in" → "priya.shah" — users have no display-name field. */
export function repLabel(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local || email;
}

export interface RepRow {
  userId: string;
  email: string;
  label: string;
  role: string;
  isActive: boolean;
  /** Visits in the requested window where this rep is the assigned agent. */
  siteVisits: number;
  /** `sales_targets.actual_bookings`, summed across matching target rows. */
  bookings: number;
  targetRevenue: number;
  achievedRevenue: number;
  /** `null` when this rep has no quota set. */
  achievement: number | null;
  hasTarget: boolean;
}

export interface BuildRepRowsArgs {
  users: TeamUser[];
  visits: TenantSiteVisit[];
  targets: SalesTarget[];
}

/**
 * One row per team member, joined on `users.id`:
 *   - visits  → `TenantSiteVisit.assignedAgentId`
 *   - targets → `sales_targets.assignee_id` (summed across every target row
 *     the caller fetched, so a period filter narrows the window naturally)
 *
 * Sorted by achieved revenue desc, then quota desc, then label — reps with
 * real numbers float to the top, everyone else stays alphabetical.
 */
export function buildRepRows({
  users,
  visits,
  targets,
}: BuildRepRowsArgs): RepRow[] {
  const visitsByAgent = new Map<string, number>();
  for (const v of visits) {
    if (!v.assignedAgentId) continue;
    visitsByAgent.set(
      v.assignedAgentId,
      (visitsByAgent.get(v.assignedAgentId) ?? 0) + 1,
    );
  }

  const targetsByAssignee = new Map<
    string,
    { target: number; achieved: number; bookings: number }
  >();
  for (const t of targets) {
    const acc = targetsByAssignee.get(t.assigneeId) ?? {
      target: 0,
      achieved: 0,
      bookings: 0,
    };
    acc.target += toNumber(t.targetRevenue);
    acc.achieved += toNumber(t.actualRevenue);
    acc.bookings += toNumber(t.actualBookings);
    targetsByAssignee.set(t.assigneeId, acc);
  }

  const rows = users.map<RepRow>((u) => {
    const agg = targetsByAssignee.get(u.id);
    const targetRevenue = agg?.target ?? 0;
    const achievedRevenue = agg?.achieved ?? 0;
    return {
      userId: u.id,
      email: u.email,
      label: repLabel(u.email),
      role: u.role,
      isActive: u.isActive !== false,
      siteVisits: visitsByAgent.get(u.id) ?? 0,
      bookings: agg?.bookings ?? 0,
      targetRevenue,
      achievedRevenue,
      achievement: achievementPct(achievedRevenue, targetRevenue),
      hasTarget: agg != null && targetRevenue > 0,
    };
  });

  return rows.sort(
    (a, b) =>
      b.achievedRevenue - a.achievedRevenue ||
      b.targetRevenue - a.targetRevenue ||
      a.label.localeCompare(b.label),
  );
}

export interface RepTotals {
  quota: number;
  achieved: number;
  siteVisits: number;
  bookings: number;
  /** How many reps actually have a quota — drives the "N of M" hint. */
  withTargets: number;
}

export function sumRepRows(rows: RepRow[]): RepTotals {
  return rows.reduce<RepTotals>(
    (acc, r) => ({
      quota: acc.quota + r.targetRevenue,
      achieved: acc.achieved + r.achievedRevenue,
      siteVisits: acc.siteVisits + r.siteVisits,
      bookings: acc.bookings + r.bookings,
      withTargets: acc.withTargets + (r.hasTarget ? 1 : 0),
    }),
    { quota: 0, achieved: 0, siteVisits: 0, bookings: 0, withTargets: 0 },
  );
}
