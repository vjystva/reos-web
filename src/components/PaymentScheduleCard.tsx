"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatCurrency } from "@/lib/formatCurrency";
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
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
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
        <CardContent className="pt-6">
          <p className="text-sm text-slate-500">
            No payment schedule found for this booking.
          </p>
        </CardContent>
      </Card>
    );
  }

  const outstanding =
    schedule.outstanding ?? (schedule.totalAmount - schedule.amountPaid);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {schedule.name ?? "Payment Schedule"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Total</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {formatCurrency(schedule.totalAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Paid</dt>
            <dd className="mt-0.5 font-semibold text-green-700">
              {formatCurrency(schedule.amountPaid)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Outstanding</dt>
            <dd className="mt-0.5 font-semibold text-red-600">
              {formatCurrency(outstanding)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
