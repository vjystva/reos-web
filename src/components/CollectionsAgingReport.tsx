"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inr } from "@/lib/utils";
import type { CollectionsAgingResponse } from "@/types/api";

interface CollectionsAgingReportProps {
  data: CollectionsAgingResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * Human labels for the wire bucket keys. Keyed off the exact strings the
 * backend sends (see COLLECTIONS_AGING_BUCKETS in @/types/api) — a mismatch
 * here would render a blank axis, so the lookup falls back to the raw key.
 */
const BUCKET_LABELS: Record<string, string> = {
  "<30": "Under 30 days",
  "30-60": "30–60 days",
  "60-90": "60–90 days",
  ">90": "Over 90 days",
};

/**
 * Severity ramp — the further right the bucket, the hotter the bar. Deliberately
 * uses the same flat Tailwind bar approach as RevenueTrendChart rather than
 * pulling in a charting dependency this app does not have.
 */
const BUCKET_BAR_CLASS: Record<string, string> = {
  "<30": "bg-amber-300",
  "30-60": "bg-amber-400",
  "60-90": "bg-orange-500",
  ">90": "bg-red-500",
};

const BUCKET_TEXT_CLASS: Record<string, string> = {
  "<30": "text-amber-700",
  "30-60": "text-amber-700",
  "60-90": "text-orange-700",
  ">90": "text-red-700",
};

function bucketLabel(bucket: string): string {
  return BUCKET_LABELS[bucket] ?? bucket;
}

/** "2026-06-30" → "30 Jun 2026". Falls back to the raw string. */
function formatDueDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CollectionsAgingReport({
  data,
  isLoading,
  isError,
  onRetry,
}: CollectionsAgingReportProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner
        message="Could not load collections aging."
        onRetry={onRetry}
      />
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-slate-500">No collections data available.</p>
    );
  }

  const { buckets, items, totalCount, totalOutstanding, asOf } = data;
  // Scale bars against the largest bucket, not the grand total — otherwise a
  // single dominant bucket flattens the other three into invisibility.
  const maxOutstanding = Math.max(
    ...buckets.map((b) => b.totalOutstanding),
    1,
  );
  const nothingOverdue = totalCount === 0;

  return (
    <div className="space-y-5">
      {/* Header: grand totals + as-of date */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">
            {inr(totalOutstanding)}
          </span>{" "}
          outstanding across{" "}
          <span className="font-semibold text-slate-900">{totalCount}</span>{" "}
          overdue {totalCount === 1 ? "milestone" : "milestones"}
        </p>
        <p className="text-xs text-slate-500">As of {formatDueDate(asOf)}</p>
      </div>

      {nothingOverdue ? (
        <p className="text-sm text-slate-500">
          Nothing overdue — every dated milestone is either paid or not yet due.
        </p>
      ) : (
        <>
          {/* Bucket bars */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {buckets.map((b) => {
              const pct =
                b.totalOutstanding > 0
                  ? Math.max((b.totalOutstanding / maxOutstanding) * 100, 3)
                  : 0;
              return (
                <div
                  key={b.bucket}
                  className="rounded-md border border-border bg-card p-3"
                >
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    {bucketLabel(b.bucket)}
                  </p>
                  <p
                    className={`mt-1 text-lg font-semibold ${
                      BUCKET_TEXT_CLASS[b.bucket] ?? "text-slate-900"
                    }`}
                  >
                    {inr(b.totalOutstanding)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {b.count} {b.count === 1 ? "milestone" : "milestones"}
                  </p>
                  <div
                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                    role="img"
                    aria-label={`${bucketLabel(b.bucket)}: ${inr(
                      b.totalOutstanding,
                    )} across ${b.count} milestones`}
                  >
                    <div
                      className={`h-full rounded-full ${
                        BUCKET_BAR_CLASS[b.bucket] ?? "bg-slate-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Underlying overdue items */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Overdue items
              </h3>
              {items.length < totalCount && (
                <span className="text-xs text-slate-500">
                  Showing {items.length} of {totalCount}, most overdue first
                </span>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit / Project</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead numeric>Days overdue</TableHead>
                  <TableHead numeric>Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.milestoneId}>
                    <TableCell>
                      <span className="font-medium text-slate-900">
                        {it.unitNumber ?? "—"}
                      </span>
                      {it.projectName ? (
                        <span className="text-slate-500">
                          {" "}
                          · {it.projectName}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-700">
                        {it.bookingNumber ?? "—"}
                      </span>
                      {it.customerName ? (
                        <span className="text-slate-500">
                          {" "}
                          · {it.customerName}
                        </span>
                      ) : null}
                      {/* A cancelled booking's receivable is still reported —
                          flag it so it is not mistaken for live collectable. */}
                      {it.bookingStatus === "cancelled" ? (
                        <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] uppercase text-slate-600">
                          cancelled
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {it.milestoneName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      {formatDueDate(it.dueDate)}
                    </TableCell>
                    <TableCell
                      numeric
                      className={BUCKET_TEXT_CLASS[it.bucket] ?? undefined}
                    >
                      {it.daysOverdue}
                    </TableCell>
                    <TableCell numeric className="font-medium text-slate-900">
                      {inr(it.outstanding)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
