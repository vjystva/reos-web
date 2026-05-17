"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatCurrency } from "@/lib/formatCurrency";
import type { RevenueTrendPoint } from "@/types/api";

interface RevenueTrendChartProps {
  trend: RevenueTrendPoint[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function shortMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-");
  if (!year || !month) return yyyyMM;
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "short", year: "2-digit" },
  );
}

export function RevenueTrendChart({
  trend,
  isLoading,
  isError,
  onRetry,
}: RevenueTrendChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-end gap-1 h-32">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <Skeleton key={i} className="flex-1 h-full rounded-t" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner message="Could not load revenue trend." onRetry={onRetry} />
    );
  }

  if (!trend || trend.length === 0) {
    return <p className="text-sm text-slate-500">No revenue data available.</p>;
  }

  const maxAmount = Math.max(...trend.map((p) => p.amount), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-32">
        {trend.map((point) => {
          const pct = Math.max((point.amount / maxAmount) * 100, 2);
          return (
            <div
              key={point.month}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              <div
                className="w-full rounded-t bg-indigo-400 hover:bg-indigo-500 transition-colors cursor-default"
                style={{ height: `${pct}%` }}
                title={`${shortMonth(point.month)}: ${formatCurrency(point.amount)}`}
                role="img"
                aria-label={`${shortMonth(point.month)}: ${formatCurrency(point.amount)}`}
              />
              <span className="absolute -bottom-5 text-[10px] text-slate-500 truncate w-full text-center">
                {shortMonth(point.month)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-500 pt-6">
        <span>{formatCurrency(0)}</span>
        <span>{formatCurrency(maxAmount)}</span>
      </div>
    </div>
  );
}
