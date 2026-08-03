"use client";

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { LeadsFunnelChart } from "@/components/LeadsFunnelChart";
import { StatusPill, type StatusTone } from "@/components/StatusPill";
import { PollIndicator } from "@/components/PollIndicator";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Button } from "@/components/ui/button";
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
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { useLeadsFunnel } from "@/hooks/useLeadsFunnel";
import { useTasks } from "@/hooks/useTasks";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUsers } from "@/hooks/useUsers";
import { useDealersPerformance } from "@/hooks/useDealersPerformance";
import { useCommissions, totalByStatus } from "@/hooks/useCommissions";
import { inr, formatDate } from "@/lib/utils";
import type { FunnelStage, Task, TaskPriority } from "@/types/api";

/* -------------------------------------------------------------------------
 * Shared helpers
 * ---------------------------------------------------------------------- */

/** Stages that are no longer "open pipeline". */
const CLOSED_STAGES = new Set(["booking", "converted", "won", "lost"]);

function openPipelineCount(funnel: FunnelStage[] | undefined): number | null {
  if (!funnel) return null;
  return funnel
    .filter((s) => !CLOSED_STAGES.has(s.stage.toLowerCase()))
    .reduce((sum, s) => sum + s.count, 0);
}

function stageCount(
  funnel: FunnelStage[] | undefined,
  stage: string,
): number | null {
  if (!funnel) return null;
  return (
    funnel.find((s) => s.stage.toLowerCase() === stage)?.count ?? 0
  );
}

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dueTs(task: Task): number | null {
  if (!task.dueDate) return null;
  const t = new Date(task.dueDate).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Open tasks with a due date, soonest first. */
function upcomingTasks(tasks: Task[] | undefined): Task[] {
  if (!tasks) return [];
  return tasks
    .filter((t) => t.status === "open" || t.status === "in_progress")
    .filter((t) => dueTs(t) != null)
    .sort((a, b) => (dueTs(a) as number) - (dueTs(b) as number));
}

const PRIORITY_TONE: Record<TaskPriority, StatusTone> = {
  urgent: "bad",
  high: "warn",
  medium: "info",
  low: "neutral",
};

/** "3d overdue" / "Today" / "Tomorrow" / "12 Mar 2026". */
function dueLabel(iso: string | null | undefined): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return "—";
  const start = startOfToday();
  const day = 86_400_000;
  const diffDays = Math.floor((t - start) / day);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays}d`;
  return formatDate(iso);
}

function pct(part: number | null | undefined, whole: number | null | undefined): number | null {
  if (part == null || whole == null || whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

/** Definition-list fact used by the Team & partner snapshot panel. */
function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums text-foreground">
        {value ?? "—"}
      </dd>
      {hint ? (
        <dd className="truncate text-[11px] text-muted-foreground">{hint}</dd>
      ) : null}
    </div>
  );
}

function FactList({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</dl>
  );
}

function FactSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="mt-1.5 h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Section 4 — Team & partner snapshot (role-adapted)
 * ---------------------------------------------------------------------- */

interface SnapshotCommonProps {
  funnel: FunnelStage[] | undefined;
  openTaskCount: number | null;
  dueTaskCount: number | null;
  overdueTaskCount: number | null;
}

/** builder_admin / admin / sales_manager — team headcount + partner roll-up. */
function TeamAndPartnerSnapshot(props: SnapshotCommonProps) {
  const usersQuery = useUsers();
  const perfQuery = useDealersPerformance({ sortBy: "revenue", order: "desc" });

  const users = usersQuery.data?.data ?? [];
  const perf = perfQuery.data ?? [];

  const agents = users.filter((u) => u.role === "sales_agent").length;
  const managers = users.filter((u) => u.role === "sales_manager").length;

  const partnerLeads = perf.reduce((s, d) => s + d.leadCount, 0);
  const partnerBookings = perf.reduce((s, d) => s + d.bookingCount, 0);
  const partnerRevenue = perf.reduce((s, d) => s + d.revenue, 0);
  const conv = pct(partnerBookings, partnerLeads);
  const top = perf[0];

  if (usersQuery.isLoading || perfQuery.isLoading) return <FactSkeleton />;

  return (
    <div className="space-y-3">
      <FactList>
        <Fact
          label="Team members"
          value={usersQuery.isError ? "—" : usersQuery.data?.total ?? 0}
          hint={
            usersQuery.isError
              ? "unavailable"
              : `${agents} agents · ${managers} managers`
          }
        />
        <Fact
          label="Channel partners"
          value={perfQuery.isError ? "—" : perf.length}
          hint={perfQuery.isError ? "unavailable" : "with recorded activity"}
        />
        <Fact
          label="Partner leads"
          value={perfQuery.isError ? "—" : partnerLeads}
        />
        <Fact
          label="Partner bookings"
          value={perfQuery.isError ? "—" : partnerBookings}
          hint={conv != null ? `${conv}% conversion` : undefined}
        />
        <Fact
          label="Partner revenue"
          value={perfQuery.isError ? "—" : inr(partnerRevenue)}
        />
        <Fact
          label="Top partner"
          value={
            top ? (
              <span className="font-sans">{top.dealerName}</span>
            ) : (
              "—"
            )
          }
          hint={top ? `${top.bookingCount} bookings · ${inr(top.revenue)}` : undefined}
        />
        <Fact label="Open follow-ups" value={props.openTaskCount ?? "—"} />
        <Fact
          label="Due / overdue"
          value={`${props.dueTaskCount ?? 0} / ${props.overdueTaskCount ?? 0}`}
        />
      </FactList>
      {usersQuery.isError || perfQuery.isError ? (
        <p className="text-[11px] text-muted-foreground">
          Some team/partner figures could not be loaded for your role.
        </p>
      ) : null}
    </div>
  );
}

/** dealer — own firm's commission book + own workload. */
function PartnerFirmSnapshot(props: SnapshotCommonProps) {
  const commissionsQuery = useCommissions();
  const commissions = commissionsQuery.data ?? [];

  if (commissionsQuery.isLoading) return <FactSkeleton />;

  const paid = totalByStatus(commissions, "paid");
  const approved = totalByStatus(commissions, "approved");
  const pending = totalByStatus(commissions, "pending");

  return (
    <div className="space-y-3">
      <FactList>
        <Fact
          label="Commission entries"
          value={commissionsQuery.isError ? "—" : commissions.length}
        />
        <Fact label="Paid" value={commissionsQuery.isError ? "—" : inr(paid)} />
        <Fact
          label="Approved"
          value={commissionsQuery.isError ? "—" : inr(approved)}
        />
        <Fact
          label="Pending"
          value={commissionsQuery.isError ? "—" : inr(pending)}
        />
        <Fact label="Open leads" value={openPipelineCount(props.funnel) ?? "—"} />
        <Fact
          label="In negotiation"
          value={stageCount(props.funnel, "negotiation") ?? "—"}
        />
        <Fact label="Open follow-ups" value={props.openTaskCount ?? "—"} />
        <Fact
          label="Due / overdue"
          value={`${props.dueTaskCount ?? 0} / ${props.overdueTaskCount ?? 0}`}
        />
      </FactList>
      {commissionsQuery.isError ? (
        <p className="text-[11px] text-muted-foreground">
          Commission figures unavailable for your role.
        </p>
      ) : null}
    </div>
  );
}

/** sales_agent / customer / unknown — own pipeline + workload only. */
function OwnWorkSnapshot(props: SnapshotCommonProps) {
  const funnel = props.funnel;
  return (
    <FactList>
      <Fact label="Open leads" value={openPipelineCount(funnel) ?? "—"} />
      <Fact label="New" value={stageCount(funnel, "new") ?? "—"} />
      <Fact label="Contacted" value={stageCount(funnel, "contacted") ?? "—"} />
      <Fact
        label="Site visits"
        value={
          funnel
            ? (stageCount(funnel, "site_visit_scheduled") ?? 0) +
              (stageCount(funnel, "site_visit_done") ?? 0)
            : "—"
        }
        hint="scheduled + done"
      />
      <Fact
        label="In negotiation"
        value={stageCount(funnel, "negotiation") ?? "—"}
      />
      <Fact label="Booked" value={stageCount(funnel, "booking") ?? "—"} />
      <Fact label="Open follow-ups" value={props.openTaskCount ?? "—"} />
      <Fact
        label="Due / overdue"
        value={`${props.dueTaskCount ?? 0} / ${props.overdueTaskCount ?? 0}`}
      />
    </FactList>
  );
}

const TEAM_ROLES = new Set(["builder_admin", "admin", "sales_manager"]);

function SnapshotPanel({
  role,
  isRoleLoading,
  ...common
}: SnapshotCommonProps & { role: string | null; isRoleLoading: boolean }) {
  if (isRoleLoading) return <FactSkeleton />;
  if (role && TEAM_ROLES.has(role)) return <TeamAndPartnerSnapshot {...common} />;
  if (role === "dealer") return <PartnerFirmSnapshot {...common} />;
  return <OwnWorkSnapshot {...common} />;
}

/* -------------------------------------------------------------------------
 * Section 5 — Next actions
 * ---------------------------------------------------------------------- */

function NextActionsTable({
  tasks,
  isLoading,
  isError,
  onRetry,
}: {
  tasks: Task[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isError) {
    return <ErrorBanner message="Failed to load follow-ups." onRetry={onRetry} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No follow-ups scheduled. Create a task from a lead to see it here.
      </p>
    );
  }

  const now = Date.now();

  return (
    <Table wrapperClassName="border-0">
      <TableHeader>
        <TableRow>
          <TableHead>Due</TableHead>
          <TableHead>Task</TableHead>
          <TableHead>Linked to</TableHead>
          <TableHead>Priority</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const ts = dueTs(task);
          const overdue = ts != null && ts < now;
          return (
            <TableRow key={task.id}>
              <TableCell
                className={
                  overdue
                    ? "whitespace-nowrap font-mono tabular-nums text-destructive"
                    : "whitespace-nowrap font-mono tabular-nums text-muted-foreground"
                }
              >
                {dueLabel(task.dueDate)}
              </TableCell>
              <TableCell className="max-w-[22rem] truncate text-foreground">
                <Link
                  href={`/dashboard/tasks?taskId=${encodeURIComponent(task.id)}`}
                  className="hover:underline"
                >
                  {task.title}
                </Link>
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {task.resourceType ? task.resourceType.replace("_", " ") : "—"}
              </TableCell>
              <TableCell>
                <StatusPill
                  className="capitalize"
                  tone={PRIORITY_TONE[task.priority] ?? "neutral"}
                >
                  {task.priority}
                </StatusPill>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* -------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

function DashboardContent() {
  const overviewQuery = useAnalyticsOverview();
  const funnelQuery = useLeadsFunnel();
  const tasksQuery = useTasks({ status: "open", limit: 50 });
  const userQuery = useCurrentUser();

  const ov = overviewQuery.data;
  const funnel = funnelQuery.data?.funnel;
  const allTasks = tasksQuery.data?.data;

  const upcoming = React.useMemo(
    () => upcomingTasks(allTasks),
    [allTasks],
  );

  const dueSoonCount = React.useMemo(() => {
    if (!upcoming.length && !allTasks) return null;
    const cutoff = endOfToday();
    return upcoming.filter((t) => (dueTs(t) as number) <= cutoff).length;
  }, [upcoming, allTasks]);

  const overdueCount = React.useMemo(() => {
    if (!allTasks) return null;
    const start = startOfToday();
    return upcoming.filter((t) => (dueTs(t) as number) < start).length;
  }, [upcoming, allTasks]);

  const openTaskCount = tasksQuery.data?.total ?? null;

  const openPipeline = openPipelineCount(funnel);
  const collectedPct = pct(ov?.collectedRevenue, ov?.totalRevenue);

  const metricsLoading = overviewQuery.isLoading;
  const metricsError = overviewQuery.isError;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Pipeline, collections and today's follow-ups"
        actions={
          <>
            <PollIndicator
              isFetching={overviewQuery.isFetching}
              isError={overviewQuery.isError}
              dataUpdatedAt={overviewQuery.dataUpdatedAt}
              onRetry={() => void overviewQuery.refetch()}
            />
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/pipeline">Open pipeline</Link>
            </Button>
          </>
        }
      />

      {/* 2 — KPI row */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Open pipeline"
            value={openPipeline}
            hint={
              funnelQuery.isError
                ? "unavailable"
                : `${ov?.totalLeads ?? "—"} leads total`
            }
            isLoading={funnelQuery.isLoading}
            isError={funnelQuery.isError}
          />
          <MetricCard
            label="Booked value"
            value={ov?.totalRevenue != null ? inr(ov.totalRevenue) : null}
            hint={
              ov?.totalBookings != null
                ? `${ov.totalBookings} bookings`
                : undefined
            }
            isLoading={metricsLoading}
            isError={metricsError}
          />
          <MetricCard
            label="Collections"
            value={
              ov?.collectedRevenue != null ? inr(ov.collectedRevenue) : null
            }
            hint={
              collectedPct != null
                ? `${collectedPct}% collected · ${
                    ov?.pendingRevenue != null ? inr(ov.pendingRevenue) : "—"
                  } pending`
                : undefined
            }
            isLoading={metricsLoading}
            isError={metricsError}
          />
          <MetricCard
            label="Bookings"
            value={ov?.totalBookings}
            hint={
              ov?.activeBookings != null
                ? `${ov.activeBookings} active`
                : undefined
            }
            isLoading={metricsLoading}
            isError={metricsError}
          />
          <MetricCard
            label="Follow-ups due"
            value={dueSoonCount}
            hint={
              tasksQuery.isError
                ? "unavailable"
                : `${overdueCount ?? 0} overdue · ${openTaskCount ?? 0} open`
            }
            isLoading={tasksQuery.isLoading}
            isError={tasksQuery.isError}
          />
          <MetricCard
            label="Available units"
            value={ov?.availableUnits}
            hint={
              ov?.totalUnits != null
                ? `of ${ov.totalUnits} · ${ov.bookedUnits ?? 0} booked`
                : undefined
            }
            isLoading={metricsLoading}
            isError={metricsError}
          />
        </div>
        {metricsError ? (
          <ErrorBanner
            className="mt-3"
            message="Failed to load dashboard metrics."
            onRetry={() => void overviewQuery.refetch()}
          />
        ) : null}
      </section>

      {/* 3 + 4 — funnel and role snapshot */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Pipeline funnel</CardTitle>
            <span className="text-[11px] text-muted-foreground">
              {openPipeline != null ? `${openPipeline} open` : ""}
            </span>
          </CardHeader>
          <CardContent>
            <LeadsFunnelChart
              funnel={funnel}
              isLoading={funnelQuery.isLoading}
              isError={funnelQuery.isError}
              onRetry={() => void funnelQuery.refetch()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team &amp; partner snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <SnapshotPanel
              role={userQuery.data?.role ?? null}
              isRoleLoading={userQuery.isLoading}
              funnel={funnel}
              openTaskCount={openTaskCount}
              dueTaskCount={dueSoonCount}
              overdueTaskCount={overdueCount}
            />
          </CardContent>
        </Card>
      </div>

      {/* 5 — next actions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Next actions</CardTitle>
          <Link
            href="/dashboard/tasks"
            className="text-[11px] font-medium text-primary hover:underline"
          >
            All tasks →
          </Link>
        </CardHeader>
        <CardContent>
          <NextActionsTable
            tasks={upcoming.slice(0, 7)}
            isLoading={tasksQuery.isLoading}
            isError={tasksQuery.isError}
            onRetry={() => void tasksQuery.refetch()}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
