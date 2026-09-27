"use client";

import * as React from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { PollIndicator } from "@/components/PollIndicator";
import { StatusPill } from "@/components/StatusPill";
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
  approvalStatusLabel,
  approvalStatusTone,
  approvalSummary,
  approvalTypeLabel,
  canResolveApprovals,
  useApprovals,
} from "@/hooks/useApprovals";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useResolveApprovalMutation } from "@/hooks/useResolveApprovalMutation";
import { formatDate } from "@/lib/utils";
import {
  APPROVAL_STATUSES,
  APPROVAL_TYPES,
  type Approval,
  type ApprovalStatus,
  type ApprovalType,
} from "@/types/api";

/**
 * Approvals queue.
 *
 * What is IN the queue is decided upstream, not here: `GET /approvals` returns
 * only the caller's own requests for a `sales_agent` and the whole tenant queue
 * for a `sales_manager` / `builder_admin`. So this one page is both "the queue I
 * action" and "the status of what I submitted", with no client-side filtering
 * that could drift from the backend's scoping.
 *
 * Approve / Reject are rendered only for roles the backend would accept
 * (`canResolveApprovals`), using `useCurrentUser()` — the same role-gating
 * mechanism as the nav and the Add-unit button. Even so, the backend re-checks:
 * it rejects an agent by role, and rejects ANY resolver who is the requester, so
 * a manager cannot self-approve. The row-level error surfaces that verbatim.
 */

const COLUMNS: { key: string; label: string; numeric?: boolean }[] = [
  { key: "type", label: "Type" },
  { key: "subject", label: "Subject" },
  { key: "detail", label: "Requested" },
  { key: "reason", label: "Reason" },
  { key: "requestedBy", label: "Requested by" },
  { key: "raised", label: "Raised", numeric: true },
  { key: "status", label: "Status" },
  { key: "resolution", label: "Resolution" },
  { key: "actions", label: "" },
];

function RowActions({ approval }: { approval: Approval }) {
  const mutation = useResolveApprovalMutation();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  if (approval.status !== "pending") {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  function resolve(action: "approve" | "reject") {
    setError(null);
    mutation.mutate(
      {
        approvalId: approval.id,
        action,
        resolutionNote: note.trim() ? note.trim() : undefined,
      },
      {
        onError: (err) => setError(err.message),
        onSuccess: () => setNote(""),
      },
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          aria-label={`Resolution note for approval ${approval.id}`}
          className="w-40"
        />
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={() => resolve("approve")}
        >
          {mutation.isPending ? "…" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => resolve("reject")}
        >
          Reject
        </Button>
      </div>
      {error ? (
        <p className="max-w-[18rem] text-right text-[11px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = React.useState<ApprovalStatus | "">(
    "pending",
  );
  const [typeFilter, setTypeFilter] = React.useState<ApprovalType | "">("");

  const userQuery = useCurrentUser();
  const canResolve = canResolveApprovals(userQuery.data?.role);

  const query = useApprovals({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  });

  // Memoised so the `??` fallback isn't a fresh array identity on every render
  // (which would re-run the tile aggregation each time).
  const rows = React.useMemo(() => query.data ?? [], [query.data]);

  // Tiles count the rows currently loaded — there is no /approvals/summary
  // aggregate upstream, and inventing one client-side across a filtered list
  // would be misleading, so the filter is stated in the hint.
  const counts = React.useMemo(() => {
    const byStatus = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      pending: byStatus("pending"),
      discounts: rows.filter((r) => r.type === "discount_request").length,
      holds: rows.filter((r) => r.type === "hold_extension").length,
    };
  }, [rows]);

  const columns = canResolve
    ? COLUMNS
    : COLUMNS.filter((c) => c.key !== "actions");

  return (
    <div className="space-y-3">
      <PageHeader
        title="Approvals"
        subtitle={
          canResolve
            ? "Discount and hold-extension requests awaiting a decision"
            : "Requests you have submitted, and where they got to"
        }
        actions={
          <>
            <PollIndicator
              isFetching={query.isFetching}
              isError={query.isError}
              dataUpdatedAt={query.dataUpdatedAt}
              onRetry={() => void query.refetch()}
            />
            <Select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ApprovalStatus | "")
              }
              aria-label="Filter by status"
              className="w-36"
            >
              <option value="">All statuses</option>
              {APPROVAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {approvalStatusLabel(s)}
                </option>
              ))}
            </Select>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ApprovalType | "")}
              aria-label="Filter by type"
              className="w-40"
            >
              <option value="">All types</option>
              {APPROVAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {approvalTypeLabel(t)}
                </option>
              ))}
            </Select>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard
          label="On this view"
          value={query.isLoading ? null : counts.total}
          hint={
            statusFilter || typeFilter
              ? "filtered"
              : canResolve
                ? "whole tenant queue"
                : "your requests"
          }
          isLoading={query.isLoading}
          isError={query.isError}
        />
        <MetricCard
          label="Pending"
          value={query.isLoading ? null : counts.pending}
          hint="awaiting a decision"
          isLoading={query.isLoading}
          isError={query.isError}
        />
        <MetricCard
          label="Discount requests"
          value={query.isLoading ? null : counts.discounts}
          hint="above the 2% agent threshold"
          isLoading={query.isLoading}
          isError={query.isError}
        />
        <MetricCard
          label="Hold extensions"
          value={query.isLoading ? null : counts.holds}
          hint="extra time on a unit hold"
          isLoading={query.isLoading}
          isError={query.isError}
        />
      </div>

      {query.isError ? (
        <ErrorBanner
          message={(query.error as Error).message}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} numeric={c.numeric}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    <Skeleton className="h-3 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : query.isError ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="py-6 text-center text-xs text-destructive"
              >
                Failed to load approvals.
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="py-6 text-center text-xs text-muted-foreground"
              >
                Nothing here
                {statusFilter
                  ? ` with status "${approvalStatusLabel(statusFilter)}"`
                  : ""}
                . Discount requests are raised from the Bookings table; hold
                extensions from the Holds page.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((approval) => {
              const summary = approvalSummary(approval);
              return (
                <TableRow key={approval.id}>
                  <TableCell className="whitespace-nowrap text-foreground">
                    {approvalTypeLabel(approval.type)}
                  </TableCell>
                  <TableCell className="font-mono text-foreground">
                    {summary.subject}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium text-foreground">
                    {summary.detail}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                    {summary.reason ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {approval.requestedBy.slice(0, 8)}
                  </TableCell>
                  <TableCell numeric className="text-muted-foreground">
                    {formatDate(approval.createdAt ?? null)}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={approvalStatusTone(approval.status)}>
                      {approvalStatusLabel(approval.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                    {approval.status === "pending"
                      ? "—"
                      : (approval.resolutionNote ??
                        `${approvalStatusLabel(approval.status)} ${formatDate(
                          approval.resolvedAt ?? null,
                        )}`)}
                  </TableCell>
                  {canResolve ? (
                    <TableCell>
                      <RowActions approval={approval} />
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <p className="text-[11px] text-muted-foreground">
        A discount of 2% or less is within a sales agent&apos;s own authority and
        is not accepted here. Approving a discount writes the percentage onto the
        booking itself; approving a hold extension moves that hold&apos;s expiry
        forward. Rejecting changes nothing except this queue. Whoever raised a
        request cannot resolve it themselves.
      </p>
    </div>
  );
}
