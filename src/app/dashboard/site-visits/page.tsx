"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { StatusPill } from "@/components/StatusPill";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SiteVisitCalendar,
  VISIT_STATUS_LABEL,
  VISIT_TONE,
  visitTooltip,
  type CalendarVisit,
} from "@/components/SiteVisitCalendar";
import { useTenantSiteVisits } from "@/hooks/useTenantSiteVisits";
import { useLeads } from "@/hooks/useLeads";
import { useProjects } from "@/hooks/useProjects";
import { useUsers } from "@/hooks/useUsers";
import {
  addMonths,
  gridRange,
  monthLabel,
  startOfMonth,
  timeLabel,
} from "@/lib/siteVisitCalendar";
import { formatDate } from "@/lib/utils";
import {
  SITE_VISIT_STATUSES,
  type SiteVisitStatus,
  type TenantSiteVisit,
} from "@/types/api";

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

/** "priya.shah@acme.in" → "priya.shah" — users have no display name field. */
function userLabel(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local || email;
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function ts(v: TenantSiteVisit): number {
  const t = new Date(v.scheduledAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const ACTIVE_STATUSES = new Set<SiteVisitStatus>(["scheduled", "confirmed"]);

/* -------------------------------------------------------------------------
 * Side panels
 * ---------------------------------------------------------------------- */

function VisitListPanel({
  title,
  items,
  emptyText,
  isLoading,
}: {
  title: string;
  items: CalendarVisit[];
  emptyText: string;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {isLoading ? "" : items.length}
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded-sm" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <Table wrapperClassName="border-0">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.visit.id} title={visitTooltip(item)}>
                  <TableCell className="whitespace-nowrap font-mono tabular-nums text-muted-foreground">
                    {formatDate(item.visit.scheduledAt)}
                    <span className="ml-1.5 text-muted-foreground/70">
                      {timeLabel(item.visit.scheduledAt)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate text-foreground">
                    <Link
                      href={`/dashboard/leads/${encodeURIComponent(item.visit.leadId)}`}
                      className="hover:underline"
                    >
                      {item.leadName}
                    </Link>
                    {item.projectName ? (
                      <span className="ml-1.5 text-muted-foreground">
                        · {item.projectName}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[9rem] truncate text-muted-foreground">
                    {item.ownerName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={VISIT_TONE[item.visit.status]}>
                      {VISIT_STATUS_LABEL[item.visit.status]}
                    </StatusPill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

export default function SiteVisitsCalendarPage() {
  const [anchor, setAnchor] = React.useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [ownerFilter, setOwnerFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<SiteVisitStatus | "">(
    "",
  );

  const range = React.useMemo(() => gridRange(anchor), [anchor]);

  const visitsQuery = useTenantSiteVisits({
    from: range.from,
    to: range.to,
    status: statusFilter || undefined,
    assignedAgentId: ownerFilter || undefined,
  });

  // Reference data for resolving FK ids to names. Failures degrade to ids
  // rather than blanking the calendar.
  const usersQuery = useUsers();
  const leadsQuery = useLeads({ pageSize: 100 });
  const projectsQuery = useProjects({ pageSize: 100 });

  const leadNames = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leadsQuery.data?.data ?? []) {
      if (l.name) m.set(l.id, l.name);
    }
    return m;
  }, [leadsQuery.data]);

  const projectNames = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projectsQuery.data?.data ?? []) m.set(p.id, p.name);
    return m;
  }, [projectsQuery.data]);

  const userNames = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usersQuery.data?.data ?? []) m.set(u.id, userLabel(u.email));
    return m;
  }, [usersQuery.data]);

  const items: CalendarVisit[] = React.useMemo(() => {
    const raw = visitsQuery.data?.data ?? [];
    return raw.map((visit) => ({
      visit,
      leadName: leadNames.get(visit.leadId) ?? `Lead ${shortId(visit.leadId)}`,
      projectName: visit.projectId
        ? (projectNames.get(visit.projectId) ?? null)
        : null,
      ownerName: visit.assignedAgentId
        ? (userNames.get(visit.assignedAgentId) ??
          shortId(visit.assignedAgentId))
        : null,
    }));
  }, [visitsQuery.data, leadNames, projectNames, userNames]);

  // `now` is sampled inside the memos so the split re-evaluates whenever the
  // data changes (60s poll / filter / month change) without a ticking timer.
  const upcoming = React.useMemo(() => {
    const now = Date.now();
    return items
      .filter((i) => ts(i.visit) >= now && ACTIVE_STATUSES.has(i.visit.status))
      .sort((a, b) => ts(a.visit) - ts(b.visit));
  }, [items]);

  const past = React.useMemo(() => {
    const now = Date.now();
    return items
      .filter((i) => ts(i.visit) < now)
      .sort((a, b) => ts(b.visit) - ts(a.visit));
  }, [items]);

  const completedCount = React.useMemo(
    () => items.filter((i) => i.visit.status === "completed").length,
    [items],
  );

  const thisMonthCount = React.useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    return items.filter((i) => {
      const d = new Date(i.visit.scheduledAt);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [items, anchor]);

  const metricsLoading = visitsQuery.isLoading;
  const metricsError = visitsQuery.isError;

  const owners = React.useMemo(
    () =>
      (usersQuery.data?.data ?? [])
        .slice()
        .sort((a, b) => a.email.localeCompare(b.email)),
    [usersQuery.data],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Site visit calendar"
        subtitle="Every scheduled, confirmed, completed and cancelled visit across the tenant"
        actions={
          <PollIndicator
            isFetching={visitsQuery.isFetching}
            isError={visitsQuery.isError}
            dataUpdatedAt={visitsQuery.dataUpdatedAt}
            onRetry={() => void visitsQuery.refetch()}
          />
        }
      />

      {/* KPI tiles */}
      <section aria-label="Site visit metrics">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Upcoming"
            value={metricsError ? null : upcoming.length}
            hint="scheduled or confirmed, from now"
            isLoading={metricsLoading}
            isError={metricsError}
          />
          <MetricCard
            label="Completed"
            value={metricsError ? null : completedCount}
            hint="in the visible range"
            isLoading={metricsLoading}
            isError={metricsError}
          />
          <MetricCard
            label="This month"
            value={metricsError ? null : thisMonthCount}
            hint={monthLabel(anchor)}
            isLoading={metricsLoading}
            isError={metricsError}
          />
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="block text-[11px] uppercase tracking-wider text-muted-foreground"
            htmlFor="visit-owner"
          >
            Sales owner
          </label>
          <Select
            id="visit-owner"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="w-56"
            disabled={usersQuery.isLoading}
          >
            <option value="">All owners</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {userLabel(u.email)} · {u.role.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label
            className="block text-[11px] uppercase tracking-wider text-muted-foreground"
            htmlFor="visit-status"
          >
            Status
          </label>
          <Select
            id="visit-status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as SiteVisitStatus | "")
            }
            className="w-40"
          >
            <option value="">All statuses</option>
            {SITE_VISIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VISIT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        {ownerFilter || statusFilter ? (
          <button
            type="button"
            onClick={() => {
              setOwnerFilter("");
              setStatusFilter("");
            }}
            className="pb-1.5 text-[11px] font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </section>

      {visitsQuery.isError ? (
        <ErrorBanner
          message="Failed to load site visits."
          onRetry={() => void visitsQuery.refetch()}
        />
      ) : null}

      {/* Month grid */}
      <SiteVisitCalendar
        anchor={anchor}
        visits={items}
        isLoading={visitsQuery.isLoading}
        onPrev={() => setAnchor((a) => addMonths(a, -1))}
        onNext={() => setAnchor((a) => addMonths(a, 1))}
        onToday={() => setAnchor(startOfMonth(new Date()))}
      />

      {/* Lists */}
      <div className="grid gap-3 lg:grid-cols-2">
        <VisitListPanel
          title="Upcoming"
          items={upcoming.slice(0, 8)}
          emptyText="No upcoming visits in this range."
          isLoading={visitsQuery.isLoading}
        />
        <VisitListPanel
          title="Past"
          items={past.slice(0, 8)}
          emptyText="No past visits in this range."
          isLoading={visitsQuery.isLoading}
        />
      </div>
    </div>
  );
}
