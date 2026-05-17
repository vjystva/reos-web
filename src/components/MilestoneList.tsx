"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatCurrency } from "@/lib/formatCurrency";
import type { MilestoneWithDerivedStatus } from "@/hooks/usePaymentMilestones";
import type { MilestoneStatus } from "@/types/api";

const STATUS_STYLES: Record<MilestoneStatus, string> = {
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  pending: "bg-slate-100 text-slate-700",
};

function MilestoneBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

interface MilestoneListProps {
  milestones: MilestoneWithDerivedStatus[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRecordPayment: (milestoneId: string) => void;
}

export function MilestoneList({
  milestones,
  isLoading,
  isError,
  onRetry,
  onRecordPayment,
}: MilestoneListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorBanner message="Could not load milestones." onRetry={onRetry} />;
  }

  if (!milestones || milestones.length === 0) {
    return (
      <p className="text-sm text-slate-500">No milestones found for this schedule.</p>
    );
  }

  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {milestones.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-slate-900">{m.name}</span>
              <MilestoneBadge status={m.derivedStatus} />
            </div>
            <div className="mt-0.5 flex gap-4 text-xs text-slate-500">
              <span>Due {new Date(m.dueDate).toLocaleDateString("en-IN")}</span>
              <span>
                {formatCurrency(m.amountPaid)} / {formatCurrency(m.dueAmount)}
              </span>
            </div>
          </div>
          {m.derivedStatus !== "paid" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRecordPayment(m.id)}
            >
              Record
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
