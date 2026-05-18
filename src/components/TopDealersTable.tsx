"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { TopDealerPoint } from "@/types/api";

interface TopDealersTableProps {
  dealers: TopDealerPoint[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function formatPercent(value: number): string {
  // Backend may send either a 0..1 ratio (0.42) or a 0..100 percentage (42).
  // Treat values <= 1 as ratios.
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

export function TopDealersTable({
  dealers,
  isLoading,
  isError,
  onRetry,
}: TopDealersTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner message="Could not load top dealers." onRetry={onRetry} />
    );
  }

  if (!dealers || dealers.length === 0) {
    return <p className="text-sm text-slate-500">No dealer data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="py-2 pr-4 font-medium">
              Dealer Name
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Lead Count
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Conversion Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {dealers.map((d) => (
            <tr
              key={d.dealerId}
              className="border-b border-slate-100 last:border-b-0"
            >
              <td className="py-2 pr-4 text-slate-800">{d.dealerName}</td>
              <td className="py-2 pr-4 text-right font-medium text-slate-800">
                {d.leadCount}
              </td>
              <td className="py-2 text-right text-slate-700">
                {formatPercent(d.conversionRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
