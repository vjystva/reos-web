"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GenerateReportForm } from "@/components/GenerateReportForm";
import { ReportJobsList } from "@/components/ReportJobsList";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { useLeadsFunnel } from "@/hooks/useLeadsFunnel";
import { useLeadsBySource } from "@/hooks/useLeadsBySource";
import { useLeads } from "@/hooks/useLeads";
import { useProjects } from "@/hooks/useProjects";
import { useUsers } from "@/hooks/useUsers";
import { useTenantSiteVisits } from "@/hooks/useTenantSiteVisits";
import { useDealers } from "@/hooks/useDealers";
import { useDealersPerformance } from "@/hooks/useDealersPerformance";
import { useCommissions } from "@/hooks/useCommissions";
import { buildRepRows, fetchSalesTargets } from "@/lib/salesPerformance";
import { buildPartnerRows } from "@/lib/partnerPerformance";
import { inr, stageLabel } from "@/lib/utils";
import type { FunnelStage, Lead } from "@/types/api";

/* -------------------------------------------------------------------------
 * Filters
 * ---------------------------------------------------------------------- */

const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "all", label: "All time" },
] as const;

type RangeValue = (typeof RANGES)[number]["value"];

/** Sample size cap: `GET /leads` maxes out at pageSize=100 server-side. */
const LEAD_SAMPLE_SIZE = 100;

function rangeStart(range: RangeValue): number | null {
  if (range === "all") return null;
  const days = Number.parseInt(range, 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.getTime();
}

function ts(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/* -------------------------------------------------------------------------
 * Panel 1 — funnel drop-off
 * ---------------------------------------------------------------------- */

interface FunnelRow {
  stage: string;
  label: string;
  /** Leads sitting in this stage right now. */
  count: number;
  /** Leads that reached this stage or any later one. */
  reached: number;
  /** Leads that stalled at the previous stage (null for the first row). */
  drop: number | null;
  pctOfTop: number | null;
}

/**
 * The funnel endpoint returns *current* stage occupancy in pipeline order.
 * Cumulative reach is therefore derived: everyone at or beyond stage i =
 * sum of the counts from i onwards. `lost` is a leak, not a step, so it is
 * pulled out of the chain and reported separately.
 */
function buildFunnelRows(funnel: FunnelStage[] | undefined): {
  rows: FunnelRow[];
  lost: number;
} {
  if (!funnel || funnel.length === 0) return { rows: [], lost: 0 };

  const isLost = (stage: string) => /lost/i.test(stage);
  const lost = funnel
    .filter((s) => isLost(s.stage))
    .reduce((sum, s) => sum + s.count, 0);
  const chain = funnel.filter((s) => !isLost(s.stage));

  const top = chain.reduce((sum, s) => sum + s.count, 0);
  let remaining = top;
  const rows: FunnelRow[] = [];

  for (const stage of chain) {
    const reached = remaining;
    const prev = rows[rows.length - 1];
    rows.push({
      stage: stage.stage,
      label: stageLabel(stage.stage),
      count: stage.count,
      reached,
      drop: prev ? prev.reached - reached : null,
      pctOfTop: top > 0 ? Math.round((reached / top) * 100) : null,
    });
    remaining -= stage.count;
  }

  return { rows, lost };
}

/* -------------------------------------------------------------------------
 * Panel 2 — source-wise conversion
 * ---------------------------------------------------------------------- */

interface SourceRow {
  source: string;
  leads: number;
  closed: number;
  conversion: number | null;
}

function sourceKey(lead: Lead): string {
  return lead.source && lead.source.trim() ? lead.source : "unknown";
}

function humanise(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : value;
}

function countBySource(leads: Lead[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of leads) m.set(sourceKey(l), (m.get(sourceKey(l)) ?? 0) + 1);
  return m;
}

function buildSourceRows(args: {
  aggregate: { source: string; count: number }[] | undefined;
  /** Recent leads sample, already range/project filtered. */
  sampleLeads: Lead[];
  /** Recent booked leads sample, already range/project filtered. */
  sampleClosed: Lead[];
  /** When a project filter is active the aggregate can't be used. */
  deriveLeadsFromSample: boolean;
}): SourceRow[] {
  const closedBySource = countBySource(args.sampleClosed);

  const leadsBySource = args.deriveLeadsFromSample
    ? countBySource(args.sampleLeads)
    : new Map<string, number>(
        (args.aggregate ?? []).map((i) => [i.source || "unknown", i.count]),
      );

  // A source can appear in the closed sample without showing up in the
  // aggregate (different windows) — union the keys so nothing is dropped.
  // `forEach` + `Array.from` rather than spread: the tsconfig has no `target`,
  // so iterator spread would need `downlevelIteration`.
  const keys = new Set<string>();
  leadsBySource.forEach((_count, source) => keys.add(source));
  closedBySource.forEach((_count, source) => keys.add(source));

  return Array.from(keys)
    .map<SourceRow>((source) => {
      const leads = leadsBySource.get(source) ?? 0;
      const closed = closedBySource.get(source) ?? 0;
      return {
        source,
        leads,
        closed,
        conversion: leads > 0 ? Math.round((closed / leads) * 100) : null,
      };
    })
    .sort((a, b) => b.leads - a.leads || b.closed - a.closed);
}

/* -------------------------------------------------------------------------
 * Shared bits
 * ---------------------------------------------------------------------- */

function PanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full rounded-sm" />
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

/** Inline share bar used in the source panel. */
function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted">
      <div
        className="h-full rounded-sm bg-chart-2"
        style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

export default function ReportsPage() {
  const [range, setRange] = React.useState<RangeValue>("90");
  const [projectId, setProjectId] = React.useState("");

  const from = React.useMemo(() => rangeStart(range), [range]);
  const fromIso = React.useMemo(
    () => (from == null ? undefined : new Date(from).toISOString()),
    [from],
  );
  const toIso = React.useMemo(() => new Date().toISOString(), []);

  /* --- data ------------------------------------------------------------ */

  const overviewQuery = useAnalyticsOverview();
  const funnelQuery = useLeadsFunnel();
  const bySourceQuery = useLeadsBySource(
    fromIso ? { from: fromIso, to: toIso } : undefined,
  );
  const leadsSampleQuery = useLeads({ pageSize: LEAD_SAMPLE_SIZE });
  const closedSampleQuery = useLeads({
    stage: "booking",
    pageSize: LEAD_SAMPLE_SIZE,
  });
  const projectsQuery = useProjects({ pageSize: 100 });
  const usersQuery = useUsers();
  const visitsQuery = useTenantSiteVisits({
    from: fromIso,
    to: toIso,
    projectId: projectId || undefined,
  });
  const targetsQuery = useQuery({
    queryKey: ["sales-targets", "all"],
    queryFn: () => fetchSalesTargets(),
    staleTime: 30_000,
    retry: 1,
  });
  const dealersQuery = useDealers();
  const dealersPerfQuery = useDealersPerformance({
    sortBy: "revenue",
    order: "desc",
  });
  const commissionsQuery = useCommissions();

  /* --- derived --------------------------------------------------------- */

  const matchesFilters = React.useCallback(
    (lead: Lead) => {
      if (from != null && ts(lead.createdAt) < from) return false;
      if (projectId && lead.projectId !== projectId) return false;
      return true;
    },
    [from, projectId],
  );

  const sampleLeads = React.useMemo(
    () => (leadsSampleQuery.data?.data ?? []).filter(matchesFilters),
    [leadsSampleQuery.data, matchesFilters],
  );

  const sampleClosed = React.useMemo(
    () => (closedSampleQuery.data?.data ?? []).filter(matchesFilters),
    [closedSampleQuery.data, matchesFilters],
  );

  const funnel = React.useMemo(
    () => buildFunnelRows(funnelQuery.data?.funnel),
    [funnelQuery.data],
  );

  const sourceRows = React.useMemo(
    () =>
      buildSourceRows({
        aggregate: bySourceQuery.data?.data,
        sampleLeads,
        sampleClosed,
        deriveLeadsFromSample: Boolean(projectId),
      }),
    [bySourceQuery.data, sampleLeads, sampleClosed, projectId],
  );

  const maxSourceLeads = Math.max(...sourceRows.map((r) => r.leads), 1);

  const repRows = React.useMemo(
    () =>
      buildRepRows({
        users: usersQuery.data?.data ?? [],
        visits: visitsQuery.data?.data ?? [],
        targets: targetsQuery.data ?? [],
      }).filter((r) => r.siteVisits > 0 || r.hasTarget || r.bookings > 0),
    [usersQuery.data, visitsQuery.data, targetsQuery.data],
  );

  const partnerRows = React.useMemo(
    () =>
      buildPartnerRows({
        dealers: dealersQuery.data?.dealers ?? [],
        performance: dealersPerfQuery.data ?? [],
        commissions: commissionsQuery.data ?? [],
      })
        .filter((r) => (r.leads ?? 0) > 0 || (r.revenue ?? 0) > 0)
        .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)),
    [dealersQuery.data, dealersPerfQuery.data, commissionsQuery.data],
  );

  const ov = overviewQuery.data;
  const conversion =
    ov?.totalLeads && ov.totalLeads > 0 && ov.totalBookings != null
      ? Math.round((ov.totalBookings / ov.totalLeads) * 100)
      : null;
  const collectedPct =
    ov?.totalRevenue && ov.totalRevenue > 0 && ov.collectedRevenue != null
      ? Math.round((ov.collectedRevenue / ov.totalRevenue) * 100)
      : null;

  const closedTotal = closedSampleQuery.data?.total ?? 0;
  const closedSampled = closedTotal > (closedSampleQuery.data?.data.length ?? 0);

  const projects = projectsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports & analytics"
        subtitle="Funnel health, source mix, sales-owner and channel-partner performance — plus report exports"
        actions={
          <PollIndicator
            isFetching={overviewQuery.isFetching}
            isError={overviewQuery.isError}
            dataUpdatedAt={overviewQuery.dataUpdatedAt}
            onRetry={() => void overviewQuery.refetch()}
          />
        }
      />

      {/* Filters */}
      <section className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="block text-[11px] uppercase tracking-wider text-muted-foreground"
            htmlFor="report-range"
          >
            Range
          </label>
          <Select
            id="report-range"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeValue)}
            className="w-40"
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label
            className="block text-[11px] uppercase tracking-wider text-muted-foreground"
            htmlFor="report-project"
          >
            Project
          </label>
          <Select
            id="report-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-56"
            disabled={projectsQuery.isLoading}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        {range !== "90" || projectId ? (
          <button
            type="button"
            onClick={() => {
              setRange("90");
              setProjectId("");
            }}
            className="pb-1.5 text-[11px] font-medium text-primary hover:underline"
          >
            Reset filters
          </button>
        ) : null}
      </section>

      {/* KPI tiles — tenant-wide totals from the analytics overview */}
      <section aria-label="Headline metrics">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Leads"
            value={ov?.totalLeads ?? null}
            hint={
              ov?.leadsThisMonth != null
                ? `${ov.leadsThisMonth} this month · ${ov.hotLeads ?? 0} hot`
                : undefined
            }
            isLoading={overviewQuery.isLoading}
            isError={overviewQuery.isError}
          />
          <MetricCard
            label="Bookings"
            value={ov?.totalBookings ?? null}
            hint={
              conversion != null
                ? `${conversion}% lead → booking`
                : `${ov?.activeBookings ?? 0} active`
            }
            isLoading={overviewQuery.isLoading}
            isError={overviewQuery.isError}
          />
          <MetricCard
            label="Booked value"
            value={ov?.totalRevenue != null ? inr(ov.totalRevenue) : null}
            hint={
              ov?.pendingRevenue != null
                ? `${inr(ov.pendingRevenue)} pending`
                : undefined
            }
            isLoading={overviewQuery.isLoading}
            isError={overviewQuery.isError}
          />
          <MetricCard
            label="Collections"
            value={
              ov?.collectedRevenue != null ? inr(ov.collectedRevenue) : null
            }
            hint={
              collectedPct != null ? `${collectedPct}% of booked value` : undefined
            }
            isLoading={overviewQuery.isLoading}
            isError={overviewQuery.isError}
          />
        </div>
        {overviewQuery.isError ? (
          <ErrorBanner
            className="mt-3"
            message="Failed to load headline metrics."
            onRetry={() => void overviewQuery.refetch()}
          />
        ) : null}
      </section>

      <p className="text-[11px] text-muted-foreground">
        Headline tiles and the partner panel are tenant-wide lifetime totals —
        the analytics endpoints take no range or project argument. The range
        filter drives the source mix and site-visit figures; the project filter
        drives site visits and the lead sample.
      </p>

      {/* Panels 1 + 2 */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Funnel drop-off */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Funnel drop-off</CardTitle>
            <span className="text-[11px] text-muted-foreground">
              leads created in the last 30 days
            </span>
          </CardHeader>
          <CardContent>
            {funnelQuery.isError ? (
              <ErrorBanner
                message="Could not load the funnel."
                onRetry={() => void funnelQuery.refetch()}
              />
            ) : funnelQuery.isLoading ? (
              <PanelSkeleton />
            ) : funnel.rows.length === 0 ? (
              <Empty>No funnel data available.</Empty>
            ) : (
              <>
                <Table wrapperClassName="border-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead numeric>Reached</TableHead>
                      <TableHead numeric>Drop</TableHead>
                      <TableHead numeric>In stage</TableHead>
                      <TableHead numeric>% of top</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnel.rows.map((row) => (
                      <TableRow key={row.stage}>
                        <TableCell className="capitalize text-foreground">
                          {row.label}
                        </TableCell>
                        <TableCell numeric className="font-semibold">
                          {row.reached}
                        </TableCell>
                        <TableCell
                          numeric
                          className={
                            row.drop && row.drop > 0
                              ? "text-right font-mono tabular-nums text-destructive"
                              : "text-right font-mono tabular-nums text-muted-foreground"
                          }
                        >
                          {row.drop == null
                            ? "—"
                            : row.drop > 0
                              ? `-${row.drop}`
                              : "0"}
                        </TableCell>
                        <TableCell numeric className="text-muted-foreground">
                          {row.count}
                        </TableCell>
                        <TableCell numeric className="text-muted-foreground">
                          {row.pctOfTop == null ? "—" : `${row.pctOfTop}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Reach is cumulative — leads at or beyond each stage. Lost:{" "}
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {funnel.lost}
                  </span>{" "}
                  (excluded from the chain, so a lead lost mid-funnel is not
                  counted as having reached the earlier stages).
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Source-wise conversion */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Source-wise conversion</CardTitle>
            <span className="text-[11px] text-muted-foreground">
              {RANGES.find((r) => r.value === range)?.label}
            </span>
          </CardHeader>
          <CardContent>
            {bySourceQuery.isError && !projectId ? (
              <ErrorBanner
                message="Could not load the source mix."
                onRetry={() => void bySourceQuery.refetch()}
              />
            ) : bySourceQuery.isLoading || closedSampleQuery.isLoading ? (
              <PanelSkeleton />
            ) : sourceRows.length === 0 ? (
              <Empty>No leads in this range.</Empty>
            ) : (
              <>
                <Table wrapperClassName="border-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead numeric>Leads</TableHead>
                      <TableHead numeric>Closed</TableHead>
                      <TableHead numeric>Conv %</TableHead>
                      <TableHead className="w-[6rem]">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceRows.map((row) => (
                      <TableRow key={row.source}>
                        <TableCell className="text-foreground">
                          {humanise(row.source)}
                        </TableCell>
                        <TableCell numeric className="font-semibold">
                          {row.leads}
                        </TableCell>
                        <TableCell numeric>{row.closed}</TableCell>
                        <TableCell numeric className="text-muted-foreground">
                          {row.conversion == null ? "—" : `${row.conversion}%`}
                        </TableCell>
                        <TableCell>
                          <ShareBar
                            pct={Math.round((row.leads / maxSourceLeads) * 100)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {projectId
                    ? `Project-filtered figures come from the ${LEAD_SAMPLE_SIZE} most recent leads (the leads API caps a page at ${LEAD_SAMPLE_SIZE}).`
                    : "Lead counts are server-side aggregates; closed counts come from the most recent booked leads."}
                  {closedSampled
                    ? ` Closed sample covers ${closedSampleQuery.data?.data.length ?? 0} of ${closedTotal} booked leads.`
                    : ""}{" "}
                  Deal value per source is not exposed by the leads API, so no
                  value column is shown.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Panels 3 + 4 */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Sales owner performance */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Sales owner performance</CardTitle>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {usersQuery.isLoading ? "" : repRows.length}
            </span>
          </CardHeader>
          <CardContent>
            {usersQuery.isError ? (
              <ErrorBanner
                message="Could not load the sales team."
                onRetry={() => void usersQuery.refetch()}
              />
            ) : usersQuery.isLoading || visitsQuery.isLoading ? (
              <PanelSkeleton />
            ) : repRows.length === 0 ? (
              <Empty>
                No site visits or quotas recorded for this range.
              </Empty>
            ) : (
              <>
                <Table wrapperClassName="border-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner</TableHead>
                      <TableHead numeric>Visits</TableHead>
                      <TableHead numeric>Closed</TableHead>
                      <TableHead numeric>Target</TableHead>
                      <TableHead className="w-[9rem]">Target %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repRows.slice(0, 8).map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell className="max-w-[11rem] truncate text-foreground">
                          {row.label}
                        </TableCell>
                        <TableCell numeric>{row.siteVisits}</TableCell>
                        <TableCell numeric>{row.bookings}</TableCell>
                        <TableCell numeric className="text-muted-foreground">
                          {row.targetRevenue > 0 ? inr(row.targetRevenue) : "—"}
                        </TableCell>
                        <TableCell>
                          {row.achievement == null ? (
                            <span className="text-[11px] text-muted-foreground">
                              no quota
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.min(row.achievement, 100)}
                                className="w-16"
                              />
                              <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
                                {row.achievement}%
                              </span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Visits are counted where the owner is the assigned agent;
                  closed deals and quota come from sales targets. Per-owner lead
                  counts are omitted — the leads API attributes a lead to its
                  channel partner, not to a sales owner.{" "}
                  <Link
                    href="/dashboard/team"
                    className="font-medium text-primary hover:underline"
                  >
                    Full roster →
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Channel partner ROI */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Channel partner ROI</CardTitle>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {dealersPerfQuery.isLoading ? "" : partnerRows.length}
            </span>
          </CardHeader>
          <CardContent>
            {dealersPerfQuery.isError ? (
              <ErrorBanner
                message="Could not load partner performance."
                onRetry={() => void dealersPerfQuery.refetch()}
              />
            ) : dealersQuery.isLoading || dealersPerfQuery.isLoading ? (
              <PanelSkeleton />
            ) : partnerRows.length === 0 ? (
              <Empty>No partner-sourced activity yet.</Empty>
            ) : (
              <>
                <Table wrapperClassName="border-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead numeric>Leads</TableHead>
                      <TableHead numeric>Conv %</TableHead>
                      <TableHead numeric>Revenue</TableHead>
                      <TableHead numeric>Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerRows.slice(0, 8).map((row) => (
                      <TableRow key={row.dealerId}>
                        <TableCell className="max-w-[11rem] truncate text-foreground">
                          <Link
                            href={`/dashboard/dealers/${encodeURIComponent(row.dealerId)}`}
                            className="hover:underline"
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell numeric>{row.leads ?? 0}</TableCell>
                        <TableCell numeric className="text-muted-foreground">
                          {row.conversion == null
                            ? "—"
                            : `${row.conversion.toFixed(1)}%`}
                        </TableCell>
                        <TableCell numeric className="font-semibold">
                          {inr(row.revenue ?? 0)}
                        </TableCell>
                        <TableCell numeric className="text-muted-foreground">
                          {row.commissionCost == null
                            ? "—"
                            : `${row.commissionEstimated ? "~" : ""}${inr(row.commissionCost)}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Commission is the partner&rsquo;s booked commission ledger
                  (pending + approved + paid). A &ldquo;~&rdquo; marks partners
                  with no commission rows yet, where the figure is estimated as
                  revenue × commission rate.{" "}
                  <Link
                    href="/dashboard/dealers"
                    className="font-medium text-primary hover:underline"
                  >
                    All partners →
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report generation + exports (pre-existing functionality) */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Generate report</CardTitle>
          </CardHeader>
          <CardContent>
            <GenerateReportForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent exports</CardTitle>
            <span className="text-[11px] text-muted-foreground">
              auto-refreshing every 15s
            </span>
          </CardHeader>
          <CardContent>
            <ReportJobsList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
