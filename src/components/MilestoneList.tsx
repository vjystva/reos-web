"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ErrorBanner } from "@/components/ErrorBanner";
import { StatusPill } from "@/components/StatusPill";
import {
  collectionIndicatorClass,
  collectionPercent,
  milestoneStatusLabel,
  milestoneStatusTone,
} from "@/lib/bookingTone";
import { formatDate, inr } from "@/lib/utils";
import type { MilestoneWithDerivedStatus } from "@/hooks/usePaymentMilestones";

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
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorBanner message="Could not load milestones." onRetry={onRetry} />;
  }

  if (!milestones || milestones.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card px-3 py-6 text-center text-xs text-muted-foreground">
        No milestones found for this schedule.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-md border border-border bg-card">
      {milestones.map((m) => {
        const percent = collectionPercent(m.amountPaid, m.dueAmount);
        return (
          <div
            key={m.id}
            className="flex items-center justify-between gap-4 px-3 py-2.5 text-xs"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-foreground">
                  {m.name}
                </span>
                <StatusPill tone={milestoneStatusTone(m.derivedStatus)}>
                  {milestoneStatusLabel(m.derivedStatus)}
                </StatusPill>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  Due{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatDate(m.dueDate)}
                  </span>
                </span>
                <span>
                  <span className="font-mono tabular-nums text-foreground">
                    {inr(m.amountPaid)}
                  </span>{" "}
                  of{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {inr(m.dueAmount)}
                  </span>
                </span>
                {percent != null ? (
                  <div className="flex items-center gap-1.5">
                    <Progress
                      value={percent}
                      aria-label={`${m.name} collected ${percent}%`}
                      className="w-20"
                      indicatorClassName={collectionIndicatorClass(percent)}
                    />
                    <span className="font-mono tabular-nums text-foreground">
                      {percent}%
                    </span>
                  </div>
                ) : null}
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
        );
      })}
    </div>
  );
}
