"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { FunnelStage } from "@/types/api";

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-400",
  contacted: "bg-indigo-400",
  qualified: "bg-violet-400",
  negotiation: "bg-amber-400",
  won: "bg-green-500",
  lost: "bg-red-400",
};

function stageColor(stage: string): string {
  return STAGE_COLORS[stage.toLowerCase()] ?? "bg-slate-400";
}

interface LeadsFunnelChartProps {
  funnel: FunnelStage[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function LeadsFunnelChart({
  funnel,
  isLoading,
  isError,
  onRetry,
}: LeadsFunnelChartProps) {
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
    return <ErrorBanner message="Could not load leads funnel." onRetry={onRetry} />;
  }

  if (!funnel || funnel.length === 0) {
    return <p className="text-sm text-slate-500">No funnel data available.</p>;
  }

  const maxCount = Math.max(...funnel.map((s) => s.count), 1);

  return (
    <div className="space-y-2">
      {funnel.map((stage) => {
        const pct = Math.round((stage.count / maxCount) * 100);
        return (
          <div key={stage.stage} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 truncate capitalize text-slate-600">
              {stage.stage}
            </span>
            <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-6 rounded-full transition-all ${stageColor(stage.stage)}`}
                style={{ width: `${pct}%` }}
                role="meter"
                aria-valuenow={stage.count}
                aria-valuemin={0}
                aria-valuemax={maxCount}
                aria-label={`${stage.stage}: ${stage.count} leads`}
              />
            </div>
            <span className="w-10 text-right font-medium text-slate-800">
              {stage.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
