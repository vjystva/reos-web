"use client";

import * as React from "react";
import { useConversionFunnel } from "@/hooks/useConversionFunnel";

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  site_visited: "Site Visited",
  negotiating: "Negotiating",
  booked: "Booked",
  completed: "Completed",
};

function formatCount(n: number): string {
  return n.toLocaleString();
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading funnel data">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-lg bg-slate-100"
          style={{ width: `${100 - i * 8}%` }}
        />
      ))}
    </div>
  );
}

export default function LeadConversionFunnelPage() {
  const { data, isLoading, isError, refetch } = useConversionFunnel();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">
        Lead Conversion Funnel
      </h1>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">
            Failed to load conversion funnel data.{" "}
            <button
              type="button"
              onClick={() => void refetch()}
              className="underline hover:no-underline"
            >
              Retry
            </button>
          </p>
        </div>
      ) : !data?.stages.length ? (
        <p className="text-sm text-slate-400">No funnel data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="pb-2 pr-6 font-medium">Stage</th>
                <th className="pb-2 pr-6 font-medium text-right">Count</th>
                <th className="pb-2 pr-6 font-medium text-right">
                  Conversion Rate
                </th>
                <th className="pb-2 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {data.stages.map((stage, idx) => {
                const label =
                  STAGE_LABELS[stage.stage] ??
                  stage.stage.replace(/_/g, " ").replace(/\b\w/g, (c) =>
                    c.toUpperCase()
                  );
                const barWidth =
                  idx === 0
                    ? 100
                    : Math.max(4, Math.round(stage.conversionRate * 100));

                return (
                  <tr
                    key={stage.stage}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-3 pr-6 font-medium text-slate-800">
                      {label}
                    </td>
                    <td className="py-3 pr-6 text-right tabular-nums text-slate-700">
                      {formatCount(stage.count)}
                    </td>
                    <td className="py-3 pr-6 text-right tabular-nums text-slate-500">
                      {idx === 0 ? "—" : formatRate(stage.conversionRate)}
                    </td>
                    <td className="py-3">
                      <div className="h-5 w-full max-w-xs overflow-hidden rounded-sm bg-slate-100">
                        <div
                          className="h-full rounded-sm bg-indigo-500 transition-all"
                          style={{ width: `${barWidth}%` }}
                          aria-label={`${barWidth}% of pipeline`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
