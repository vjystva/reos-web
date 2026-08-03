"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUsers } from "@/hooks/useUsers";
import { useTenantSiteVisits } from "@/hooks/useTenantSiteVisits";
import { useCreateUserMutation } from "@/hooks/useCreateUserMutation";
import {
  buildRepRows,
  fetchSalesTargets,
  sumRepRows,
  type RepRow,
} from "@/lib/salesPerformance";
import { inr } from "@/lib/utils";
import { CreateUserRequestSchema, USER_ROLES } from "@/types/api";
import type { CreateUserRequest } from "@/types/api";

const ROLE_LABELS: Record<string, string> = {
  builder_admin: "Builder Admin",
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_agent: "Sales Agent",
  dealer: "Channel Partner / Dealer",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

/** Site-visit window: recent history plus everything already scheduled. */
const VISIT_LOOKBACK_DAYS = 180;
const VISIT_LOOKAHEAD_DAYS = 90;

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Quota attainment bar — green at target, amber mid, red when far behind. */
function achievementIndicator(pct: number): string {
  if (pct >= 100) return "bg-chart-4";
  if (pct >= 75) return "bg-chart-2";
  if (pct >= 40) return "bg-accent";
  return "bg-chart-5";
}

/* -------------------------------------------------------------------------
 * Create-user form (unchanged behaviour, token-styled)
 * ---------------------------------------------------------------------- */

interface CreateUserFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateUserRequest) => void;
  onCancel: () => void;
}

function CreateUserForm({
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: CreateUserFormProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<string>(USER_ROLES[0]);
  const [validationErrors, setValidationErrors] = React.useState<
    Record<string, string>
  >({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = CreateUserRequestSchema.safeParse({ email, password, role });
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setValidationErrors(
        Object.fromEntries(
          Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ""]),
        ),
      );
      return;
    }
    setValidationErrors({});
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-1">
        <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">
          Email
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          autoComplete="email"
        />
        {validationErrors.email && (
          <p className="text-xs text-red-600">{validationErrors.email}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">
          Password
        </label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
        />
        {validationErrors.password && (
          <p className="text-xs text-red-600">{validationErrors.password}</p>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">
          Role
        </label>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </Select>
        {validationErrors.role && (
          <p className="text-xs text-red-600">{validationErrors.role}</p>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Creating…" : "Create user"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------
 * Roster table
 * ---------------------------------------------------------------------- */

function TeamTable({
  rows,
  isLoading,
}: {
  rows: RepRow[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-xs text-muted-foreground">
        No team members yet. Add your first user to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rep</TableHead>
          <TableHead>Role</TableHead>
          <TableHead numeric>Site visits</TableHead>
          <TableHead numeric>Bookings</TableHead>
          <TableHead numeric>Target</TableHead>
          <TableHead numeric>Achieved</TableHead>
          <TableHead className="w-[11rem]">Achievement</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.userId}>
            <TableCell className="max-w-[16rem]">
              <span className="block truncate font-medium text-foreground">
                {row.label}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {row.email}
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {roleLabel(row.role)}
            </TableCell>
            <TableCell numeric>{row.siteVisits}</TableCell>
            <TableCell numeric>
              {row.hasTarget || row.bookings > 0 ? (
                row.bookings
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell numeric>
              {row.targetRevenue > 0 ? (
                inr(row.targetRevenue)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell numeric>
              {row.achievedRevenue > 0 ? (
                inr(row.achievedRevenue)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {row.achievement == null ? (
                <span className="text-[11px] text-muted-foreground">
                  No quota set
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <Progress
                    value={Math.min(row.achievement, 100)}
                    indicatorClassName={achievementIndicator(row.achievement)}
                    aria-label={`${row.label} quota attainment`}
                    className="w-24"
                  />
                  <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
                    {row.achievement}%
                  </span>
                </div>
              )}
            </TableCell>
            <TableCell>
              <StatusPill tone={row.isActive ? "good" : "neutral"}>
                {row.isActive ? "Active" : "Inactive"}
              </StatusPill>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* -------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

export default function TeamPage() {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState("");

  const usersQuery = useUsers();
  const createMutation = useCreateUserMutation();

  const visitRange = React.useMemo(
    () => ({
      from: isoDaysFromNow(-VISIT_LOOKBACK_DAYS),
      to: isoDaysFromNow(VISIT_LOOKAHEAD_DAYS),
    }),
    [],
  );

  const visitsQuery = useTenantSiteVisits(visitRange);

  const targetsQuery = useQuery({
    queryKey: ["sales-targets", period || "all"],
    queryFn: () => fetchSalesTargets(period ? { period } : {}),
    staleTime: 30_000,
    retry: 1,
  });

  const rows = React.useMemo(
    () =>
      buildRepRows({
        users: usersQuery.data?.data ?? [],
        visits: visitsQuery.data?.data ?? [],
        targets: targetsQuery.data ?? [],
      }),
    [usersQuery.data, visitsQuery.data, targetsQuery.data],
  );

  const totals = React.useMemo(() => sumRepRows(rows), [rows]);
  const attainment =
    totals.quota > 0 ? Math.round((totals.achieved / totals.quota) * 100) : null;

  async function handleCreate(data: CreateUserRequest) {
    setFormError(null);
    try {
      await createMutation.mutateAsync(data);
      setSheetOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create user",
      );
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team"
        subtitle="Sales roster, site-visit activity and quota attainment"
        actions={
          <>
            <PollIndicator
              isFetching={usersQuery.isFetching}
              isError={usersQuery.isError}
              dataUpdatedAt={usersQuery.dataUpdatedAt}
              onRetry={() => void usersQuery.refetch()}
            />
            <Button
              onClick={() => {
                setSheetOpen(true);
                setFormError(null);
              }}
            >
              Add user
            </Button>
          </>
        }
      />

      {/* KPI tiles */}
      <section aria-label="Team metrics">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Quota"
            value={targetsQuery.isError ? null : inr(totals.quota)}
            hint={
              targetsQuery.isError
                ? "unavailable"
                : `${totals.withTargets} of ${rows.length} reps with a target`
            }
            isLoading={targetsQuery.isLoading}
            isError={targetsQuery.isError}
          />
          <MetricCard
            label="Achieved"
            value={targetsQuery.isError ? null : inr(totals.achieved)}
            hint={
              attainment != null ? `${attainment}% of quota` : "no quota set yet"
            }
            isLoading={targetsQuery.isLoading}
            isError={targetsQuery.isError}
          />
          <MetricCard
            label="Site visits"
            value={visitsQuery.isError ? null : totals.siteVisits}
            hint={`last ${VISIT_LOOKBACK_DAYS}d + scheduled`}
            isLoading={visitsQuery.isLoading}
            isError={visitsQuery.isError}
          />
          <MetricCard
            label="Bookings"
            value={targetsQuery.isError ? null : totals.bookings}
            hint="recorded against sales targets"
            isLoading={targetsQuery.isLoading}
            isError={targetsQuery.isError}
          />
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="block text-[11px] uppercase tracking-wider text-muted-foreground"
            htmlFor="team-period"
          >
            Quota period
          </label>
          <Select
            id="team-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-40"
          >
            <option value="">All periods</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </Select>
        </div>
        <span className="pb-1.5 text-[11px] text-muted-foreground">
          {usersQuery.isLoading ? "" : `${rows.length} team members`}
        </span>
      </section>

      {usersQuery.isError ? (
        <ErrorBanner
          message="Could not load team members."
          onRetry={() => void usersQuery.refetch()}
        />
      ) : (
        <TeamTable rows={rows} isLoading={usersQuery.isLoading} />
      )}

      <p className="text-[11px] text-muted-foreground">
        Targets, achieved revenue and bookings come from sales targets; site
        visits are counted from visits where the rep is the assigned agent.
        Per-rep lead counts are not shown — the leads API attributes a lead to
        its channel partner (<code>assignedDealerId</code>), not to a sales
        owner, so any per-rep lead figure would be misattributed. Regional
        assignment is not modelled on the user record either.
        {targetsQuery.isError
          ? " Sales targets could not be loaded, so quota columns are empty."
          : ""}
      </p>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add team member</SheetTitle>
            <SheetDescription>
              Create a new user account with a designated role.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CreateUserForm
              isSubmitting={createMutation.isPending}
              error={formError}
              onSubmit={(data) => void handleCreate(data)}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
