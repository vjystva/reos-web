"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill, statusTone } from "@/components/StatusPill";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DealerForm } from "@/components/DealerForm";
import { useDealer } from "@/hooks/useDealer";
import { useDealerPerformance } from "@/hooks/useDealerPerformance";
import { useCommissions, formatCommissionStatus } from "@/hooks/useCommissions";
import { useUpdateDealerMutation } from "@/hooks/useUpdateDealerMutation";
import { useDeactivateDealerMutation } from "@/hooks/useDeactivateDealerMutation";
import { useUpdateCommissionStatusMutation } from "@/hooks/useUpdateCommissionStatusMutation";
import {
  commissionTotalsByDealer,
  conversionPercent,
  dealerStatusLabel,
  dealerStatusTone,
  kycLabel,
  kycTone,
} from "@/lib/partnerPerformance";
import { formatDate, inr } from "@/lib/utils";
import type { CommissionStatus, CreateDealerRequest } from "@/types/api";

interface PageProps {
  params: { dealerId: string };
}

/**
 * Commission workflow — the forward moves offered per current status.
 *
 * Backend `PATCH /commissions/:id/status` accepts any of the four states with
 * no transition guard, so the guard lives here: a paid or cancelled row is
 * terminal (no actions), pending can be approved or cancelled, approved can be
 * paid or cancelled.
 */
const COMMISSION_NEXT_STATES: Record<
  CommissionStatus,
  { status: CommissionStatus; label: string; destructive?: boolean }[]
> = {
  pending: [
    { status: "approved", label: "Approve" },
    { status: "cancelled", label: "Cancel", destructive: true },
  ],
  approved: [
    { status: "paid", label: "Mark paid" },
    { status: "cancelled", label: "Cancel", destructive: true },
  ],
  paid: [],
  cancelled: [],
};

/** Definition-list fact — same recipe as the dashboard snapshot panel. */
function Fact({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "mt-0.5 truncate font-mono text-sm font-semibold tabular-nums text-foreground"
            : "mt-0.5 truncate text-sm font-medium text-foreground"
        }
      >
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export default function DealerDetailPage({ params }: PageProps) {
  const { dealerId } = params;
  const router = useRouter();
  const { data: dealer, isLoading, isError, refetch } = useDealer(dealerId);
  const performanceQuery = useDealerPerformance(dealerId);
  const commissionsQuery = useCommissions(dealerId);
  const updateMutation = useUpdateDealerMutation();
  const deactivateMutation = useDeactivateDealerMutation();
  const commissionStatusMutation = useUpdateCommissionStatusMutation();

  const [editOpen, setEditOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deactivateError, setDeactivateError] = React.useState<string | null>(
    null,
  );
  const [commissionError, setCommissionError] = React.useState<string | null>(
    null,
  );

  const commissions = React.useMemo(
    () => commissionsQuery.data ?? [],
    [commissionsQuery.data],
  );

  const commissionTotals = React.useMemo(
    () => commissionTotalsByDealer(commissions).get(dealerId) ?? null,
    [commissions, dealerId],
  );

  async function handleUpdate(data: CreateDealerRequest) {
    setFormError(null);
    try {
      await updateMutation.mutateAsync({ dealerId, body: data });
      setEditOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update dealer",
      );
    }
  }

  async function handleCommissionStatus(
    commissionId: string,
    status: CommissionStatus,
  ) {
    if (
      status === "cancelled" &&
      typeof window !== "undefined" &&
      !window.confirm(
        "Cancel this commission? It stops counting towards payouts due.",
      )
    ) {
      return;
    }
    setCommissionError(null);
    try {
      await commissionStatusMutation.mutateAsync({ commissionId, status });
    } catch (err) {
      setCommissionError(
        err instanceof Error
          ? err.message
          : "Failed to update commission status",
      );
    }
  }

  async function handleDeactivate() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Deactivate dealer "${dealer?.name ?? dealerId}"? They will no longer be assigned new leads.`,
      )
    ) {
      return;
    }
    setDeactivateError(null);
    try {
      await deactivateMutation.mutateAsync({ dealerId });
      router.push("/dashboard/dealers");
    } catch (err) {
      setDeactivateError(
        err instanceof Error ? err.message : "Failed to deactivate dealer",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !dealer) {
    return (
      <div className="space-y-3">
        <ErrorBanner
          message="Could not load dealer details."
          onRetry={() => void refetch()}
        />
        <Link
          href="/dashboard/dealers"
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Back to channel partners
        </Link>
      </div>
    );
  }

  const perf = performanceQuery.data;
  const conversion = conversionPercent(perf?.conversionRate);

  return (
    <div className="space-y-4">
      <PageHeader
        title={dealer.name}
        subtitle={
          dealer.company
            ? `${dealer.company} · channel partner`
            : "Channel partner"
        }
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/dealers">← Partners</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeactivate}
              disabled={
                deactivateMutation.isPending || dealer.status === "inactive"
              }
            >
              {deactivateMutation.isPending ? "Deactivating…" : "Deactivate"}
            </Button>
          </>
        }
      />

      {deactivateError ? <ErrorBanner message={deactivateError} /> : null}

      {/* Performance tiles */}
      <section aria-label="Partner performance">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard
            label="Leads sourced"
            value={perf?.leadCount ?? null}
            isLoading={performanceQuery.isLoading}
            isError={performanceQuery.isError}
          />
          <MetricCard
            label="Bookings"
            value={perf?.bookingCount ?? null}
            hint={
              conversion != null ? `${conversion.toFixed(1)}% conversion` : undefined
            }
            isLoading={performanceQuery.isLoading}
            isError={performanceQuery.isError}
          />
          <MetricCard
            label="Revenue sourced"
            value={perf?.revenue != null ? inr(perf.revenue) : null}
            isLoading={performanceQuery.isLoading}
            isError={performanceQuery.isError}
          />
          <MetricCard
            label="Payout due"
            value={
              commissionsQuery.isError ? null : inr(commissionTotals?.due ?? 0)
            }
            hint="pending + approved"
            isLoading={commissionsQuery.isLoading}
            isError={commissionsQuery.isError}
          />
          <MetricCard
            label="Paid out"
            value={
              commissionsQuery.isError ? null : inr(commissionTotals?.paid ?? 0)
            }
            hint={`${commissionTotals?.rows ?? 0} commission entries`}
            isLoading={commissionsQuery.isLoading}
            isError={commissionsQuery.isError}
          />
        </div>
        {performanceQuery.isError ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Performance figures are unavailable for this partner.
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Partner details */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Partner details</CardTitle>
            <StatusPill tone={dealerStatusTone(dealer.status)}>
              {dealerStatusLabel(dealer.status)}
            </StatusPill>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <Fact label="Firm" value={dealer.company ?? null} mono={false} />
              <Fact label="Email" value={dealer.email ?? null} mono={false} />
              <Fact label="Phone" value={dealer.phone ?? null} />
              <Fact label="RERA id" value={dealer.reraId ?? null} />
              <Fact
                label="KYC"
                mono={false}
                value={
                  dealer.kycStatus ? (
                    <StatusPill tone={kycTone(dealer.kycStatus)}>
                      {kycLabel(dealer.kycStatus)}
                    </StatusPill>
                  ) : null
                }
              />
              <Fact
                label="Commission rate"
                value={
                  dealer.commissionRate != null
                    ? `${dealer.commissionRate}%`
                    : null
                }
              />
              <Fact label="Onboarded" value={formatDate(dealer.createdAt)} />
              <Fact label="Updated" value={formatDate(dealer.updatedAt)} />
            </dl>
          </CardContent>
        </Card>

        {/* Commission ledger */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Commission ledger</CardTitle>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {commissionsQuery.isLoading ? "" : `${commissions.length} entries`}
            </span>
          </CardHeader>
          <CardContent>
            {commissionsQuery.isError ? (
              <ErrorBanner
                message="Could not load commissions."
                onRetry={() => void commissionsQuery.refetch()}
              />
            ) : commissionsQuery.isLoading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full rounded-sm" />
                ))}
              </div>
            ) : commissions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No commission entries yet. They are raised automatically when a
                booking sourced by this partner is confirmed.
              </p>
            ) : (
              <>
                {commissionError ? (
                  <div className="mb-2">
                    <ErrorBanner message={commissionError} />
                  </div>
                ) : null}
                <Table wrapperClassName="border-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead numeric>Rate</TableHead>
                      <TableHead numeric>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid on</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => {
                      const actions = COMMISSION_NEXT_STATES[c.status] ?? [];
                      const busy =
                        commissionStatusMutation.isPending &&
                        commissionStatusMutation.variables?.commissionId ===
                          c.id;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="whitespace-nowrap font-mono text-muted-foreground">
                            {c.bookingId.slice(0, 8)}…
                          </TableCell>
                          <TableCell numeric>{c.rate}%</TableCell>
                          <TableCell numeric className="text-right font-mono font-semibold tabular-nums">
                            {inr(Number.parseFloat(c.amount))}
                          </TableCell>
                          <TableCell>
                            <StatusPill tone={statusTone(c.status)}>
                              {formatCommissionStatus(c.status)}
                            </StatusPill>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {c.paidAt ? formatDate(c.paidAt) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {actions.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="inline-flex justify-end gap-1">
                                {actions.map((a) => (
                                  <Button
                                    key={a.status}
                                    size="sm"
                                    variant={
                                      a.destructive ? "ghost" : "outline"
                                    }
                                    className={
                                      a.destructive
                                        ? "h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                                        : "h-6 px-2 text-[11px]"
                                    }
                                    disabled={
                                      commissionStatusMutation.isPending
                                    }
                                    onClick={() =>
                                      void handleCommissionStatus(
                                        c.id,
                                        a.status,
                                      )
                                    }
                                  >
                                    {busy &&
                                    commissionStatusMutation.variables
                                      ?.status === a.status
                                      ? "Saving…"
                                      : a.label}
                                  </Button>
                                ))}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditOpen(false);
            setFormError(null);
          }
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit dealer</SheetTitle>
            <SheetDescription>
              Update the dealer details below.
            </SheetDescription>
          </SheetHeader>
          {editOpen ? (
            <DealerForm
              initial={dealer}
              isSubmitting={updateMutation.isPending}
              error={formError}
              onCancel={() => {
                setEditOpen(false);
                setFormError(null);
              }}
              submitLabel="Save changes"
              onSubmit={(data) => void handleUpdate(data)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
