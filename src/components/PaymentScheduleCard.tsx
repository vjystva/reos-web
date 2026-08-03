"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  collectionIndicatorClass,
  collectionPercent,
} from "@/lib/bookingTone";
import { inr } from "@/lib/utils";
import type { PaymentSchedule } from "@/types/api";

interface PaymentScheduleCardProps {
  schedule: PaymentSchedule | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function PaymentScheduleCard({
  schedule,
  isLoading,
  isError,
  onRetry,
}: PaymentScheduleCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-3 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-1.5 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-3">
          <ErrorBanner
            message="Could not load payment schedule."
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }

  if (!schedule) {
    return (
      <Card>
        <CardContent className="pt-3">
          <p className="text-xs text-muted-foreground">
            No payment schedule found for this booking.
          </p>
        </CardContent>
      </Card>
    );
  }

  const outstanding =
    schedule.outstanding ?? (schedule.totalAmount - schedule.amountPaid);
  const percent = collectionPercent(schedule.amountPaid, schedule.totalAmount);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{schedule.name ?? "Payment Schedule"}</CardTitle>
        {percent != null ? (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {percent}% collected
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Total
            </dt>
            <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-foreground">
              {inr(schedule.totalAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Collected
            </dt>
            <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-chart-4">
              {inr(schedule.amountPaid)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Outstanding
            </dt>
            <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-foreground">
              {inr(outstanding)}
            </dd>
          </div>
        </dl>

        <Progress
          value={percent ?? 0}
          aria-label={`Collection progress ${percent ?? 0}%`}
          indicatorClassName={collectionIndicatorClass(percent)}
        />
      </CardContent>
    </Card>
  );
}
