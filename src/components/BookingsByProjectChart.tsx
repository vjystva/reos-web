"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatCurrency } from "@/lib/formatCurrency";
import type { BookingsByProjectPoint } from "@/types/api";

interface BookingsByProjectChartProps {
  data: BookingsByProjectPoint[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function BookingsByProjectChart({
  data,
  isLoading,
  isError,
  onRetry,
}: BookingsByProjectChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner
        message="Could not load bookings by project."
        onRetry={onRetry}
      />
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-slate-500">No project data available.</p>;
  }

  const maxCount = Math.max(...data.map((p) => p.bookingCount), 1);

  return (
    <div className="space-y-2">
      {data.map((point) => {
        const pct = Math.round((point.bookingCount / maxCount) * 100);
        return (
          <div
            key={point.projectId}
            className="flex items-center gap-3 text-sm"
          >
            <span
              className="w-32 shrink-0 truncate text-slate-600"
              title={point.projectName}
            >
              {point.projectName}
            </span>
            <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-6 rounded-full bg-emerald-400 transition-all"
                style={{ width: `${pct}%` }}
                role="meter"
                aria-valuenow={point.bookingCount}
                aria-valuemin={0}
                aria-valuemax={maxCount}
                aria-label={`${point.projectName}: ${point.bookingCount} bookings, revenue ${formatCurrency(point.totalRevenue)}`}
                title={`${point.bookingCount} bookings — ${formatCurrency(point.totalRevenue)}`}
              />
            </div>
            <span className="w-10 text-right font-medium text-slate-800">
              {point.bookingCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
