"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DealerForm } from "@/components/DealerForm";
import { useDealers } from "@/hooks/useDealers";
import { useDealersPerformance } from "@/hooks/useDealersPerformance";
import { useCommissions } from "@/hooks/useCommissions";
import { useCreateDealerMutation } from "@/hooks/useCreateDealerMutation";
import { useUpdateDealerMutation } from "@/hooks/useUpdateDealerMutation";
import {
  buildPartnerRows,
  dealerStatusLabel,
  dealerStatusTone,
  kycLabel,
  kycTone,
  sumPartnerRows,
  type PartnerRow,
} from "@/lib/partnerPerformance";
import { inr } from "@/lib/utils";
import type { CreateDealerRequest, Dealer } from "@/types/api";

type SheetMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; dealer: Dealer };

type StatusFilter = "all" | "active" | "inactive";

/** "—" for absent values so a sparse row still reads as a row. */
function dash(value: React.ReactNode | null | undefined): React.ReactNode {
  return value == null || value === "" ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    value
  );
}

function num(value: number | null | undefined): React.ReactNode {
  return value == null ? <span className="text-muted-foreground">—</span> : value;
}

function money(value: number | null | undefined): React.ReactNode {
  return value == null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    inr(value)
  );
}

/* -------------------------------------------------------------------------
 * Partner table
 * ---------------------------------------------------------------------- */

function PartnerTable({
  rows,
  isLoading,
  onEdit,
}: {
  rows: PartnerRow[];
  isLoading: boolean;
  onEdit: (dealerId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-xs text-muted-foreground">
        No channel partners match these filters. Click &ldquo;Add dealer&rdquo;
        to onboard one.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Partner / firm</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>RERA id</TableHead>
          <TableHead>KYC</TableHead>
          <TableHead numeric>Leads</TableHead>
          <TableHead numeric>Bookings</TableHead>
          <TableHead numeric>Revenue</TableHead>
          <TableHead numeric>Comm %</TableHead>
          <TableHead numeric>Payout due</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.dealerId}>
            <TableCell className="max-w-[14rem]">
              <Link
                href={`/dashboard/dealers/${encodeURIComponent(row.dealerId)}`}
                className="block truncate font-medium text-foreground hover:underline"
              >
                {row.name}
              </Link>
              <span className="block truncate text-[11px] text-muted-foreground">
                {row.firm ?? "No firm on record"}
              </span>
            </TableCell>
            <TableCell className="max-w-[13rem] truncate text-muted-foreground">
              {dash(row.email)}
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono tabular-nums text-muted-foreground">
              {dash(row.phone)}
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-muted-foreground">
              {dash(row.reraId)}
            </TableCell>
            <TableCell>
              {row.kycStatus ? (
                <StatusPill tone={kycTone(row.kycStatus)}>
                  {kycLabel(row.kycStatus)}
                </StatusPill>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell numeric>{num(row.leads)}</TableCell>
            <TableCell numeric>{num(row.bookings)}</TableCell>
            <TableCell numeric>{money(row.revenue)}</TableCell>
            <TableCell numeric>
              {row.commissionRate == null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                `${row.commissionRate}%`
              )}
            </TableCell>
            <TableCell
              numeric
              className={
                row.payoutDue > 0
                  ? "text-right font-mono tabular-nums text-accent-foreground"
                  : undefined
              }
            >
              {row.payoutDue > 0 ? inr(row.payoutDue) : "—"}
            </TableCell>
            <TableCell>
              <StatusPill tone={dealerStatusTone(row.status)}>
                {dealerStatusLabel(row.status)}
              </StatusPill>
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(row.dealerId)}
              >
                Edit
              </Button>
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

export default function DealersPage() {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [regionFilter, setRegionFilter] = React.useState("");
  const [sheet, setSheet] = React.useState<SheetMode>({ kind: "closed" });
  const [formError, setFormError] = React.useState<string | null>(null);

  // isActive maps to status: "active" → true, "inactive" → false, "all" → undef
  const isActive =
    statusFilter === "active"
      ? true
      : statusFilter === "inactive"
        ? false
        : undefined;

  const dealersQuery = useDealers({
    isActive,
    region: regionFilter.trim() || undefined,
  });
  const performanceQuery = useDealersPerformance({
    sortBy: "revenue",
    order: "desc",
  });
  const commissionsQuery = useCommissions();

  const createMutation = useCreateDealerMutation();
  const updateMutation = useUpdateDealerMutation();

  const dealers = React.useMemo(
    () => dealersQuery.data?.dealers ?? [],
    [dealersQuery.data],
  );

  const rows = React.useMemo(
    () =>
      buildPartnerRows({
        dealers,
        performance: performanceQuery.data ?? [],
        commissions: commissionsQuery.data ?? [],
      }),
    [dealers, performanceQuery.data, commissionsQuery.data],
  );

  const totals = React.useMemo(() => sumPartnerRows(rows), [rows]);
  const conversion =
    totals.leads > 0
      ? Math.round((totals.bookings / totals.leads) * 100)
      : null;

  function closeSheet() {
    setSheet({ kind: "closed" });
    setFormError(null);
  }

  async function handleCreate(data: CreateDealerRequest) {
    setFormError(null);
    try {
      await createMutation.mutateAsync(data);
      closeSheet();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create dealer",
      );
    }
  }

  async function handleUpdate(dealerId: string, data: CreateDealerRequest) {
    setFormError(null);
    try {
      await updateMutation.mutateAsync({ dealerId, body: data });
      closeSheet();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update dealer",
      );
    }
  }

  const perfLoading = performanceQuery.isLoading || dealersQuery.isLoading;
  const perfError = performanceQuery.isError;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Channel partners"
        subtitle="Partner roster, sourced pipeline, commissions and KYC standing"
        actions={
          <>
            <PollIndicator
              isFetching={dealersQuery.isFetching}
              isError={dealersQuery.isError}
              dataUpdatedAt={dealersQuery.dataUpdatedAt}
              onRetry={() => void dealersQuery.refetch()}
            />
            <Button onClick={() => setSheet({ kind: "create" })}>
              Add dealer
            </Button>
          </>
        }
      />

      {/* KPI tiles — partner-sourced pipeline and money owed */}
      <section aria-label="Channel partner metrics">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Partner-sourced leads"
            value={perfError ? null : totals.leads}
            hint={
              perfError
                ? "unavailable"
                : `${totals.withPerformance} of ${totals.partners} partners active`
            }
            isLoading={perfLoading}
            isError={perfError}
          />
          <MetricCard
            label="Partner bookings"
            value={perfError ? null : totals.bookings}
            hint={
              conversion != null ? `${conversion}% conversion` : "no leads yet"
            }
            isLoading={perfLoading}
            isError={perfError}
          />
          <MetricCard
            label="Revenue sourced"
            value={perfError ? null : inr(totals.revenue)}
            hint="booked value attributed to partners"
            isLoading={perfLoading}
            isError={perfError}
          />
          <MetricCard
            label="Payouts due"
            value={
              commissionsQuery.isError ? null : inr(totals.payoutDue)
            }
            hint="pending + approved commissions"
            isLoading={commissionsQuery.isLoading}
            isError={commissionsQuery.isError}
          />
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="block text-[11px] uppercase tracking-wider text-muted-foreground"
            htmlFor="filter-region"
          >
            Region
          </label>
          <Input
            id="filter-region"
            type="text"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            placeholder="Search by region"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <label
            className="block text-[11px] uppercase tracking-wider text-muted-foreground"
            htmlFor="filter-status"
          >
            Status
          </label>
          <Select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-40"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        {regionFilter || statusFilter !== "all" ? (
          <button
            type="button"
            onClick={() => {
              setRegionFilter("");
              setStatusFilter("all");
            }}
            className="pb-1.5 text-[11px] font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        ) : null}
        <span className="pb-1.5 text-[11px] text-muted-foreground">
          {dealersQuery.isLoading ? "" : `${rows.length} partners`}
        </span>
      </section>

      {dealersQuery.isError ? (
        <ErrorBanner
          message="Failed to load dealers."
          onRetry={() => void dealersQuery.refetch()}
        />
      ) : (
        <PartnerTable
          rows={rows}
          isLoading={dealersQuery.isLoading}
          onEdit={(dealerId) => {
            const dealer = dealers.find((d) => d.id === dealerId);
            if (dealer) setSheet({ kind: "edit", dealer });
          }}
        />
      )}

      {performanceQuery.isError && !dealersQuery.isError ? (
        <p className="text-[11px] text-muted-foreground">
          Lead, booking and revenue columns are unavailable — the partner
          performance endpoint did not respond.
        </p>
      ) : null}

      <Sheet
        open={sheet.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {sheet.kind === "edit" ? "Edit dealer" : "Add dealer"}
            </SheetTitle>
            <SheetDescription>
              {sheet.kind === "edit"
                ? "Update the dealer details below."
                : "Fill in the details and click Create dealer."}
            </SheetDescription>
          </SheetHeader>

          {sheet.kind !== "closed" ? (
            <DealerForm
              initial={sheet.kind === "edit" ? sheet.dealer : null}
              isSubmitting={
                createMutation.isPending || updateMutation.isPending
              }
              error={formError}
              onCancel={closeSheet}
              submitLabel={
                sheet.kind === "edit" ? "Save changes" : "Create dealer"
              }
              onSubmit={(data) => {
                if (sheet.kind === "edit") {
                  void handleUpdate(sheet.dealer.id, data);
                } else {
                  void handleCreate(data);
                }
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
