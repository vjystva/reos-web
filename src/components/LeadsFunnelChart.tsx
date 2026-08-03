"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { stageLabel } from "@/lib/utils";
import type { FunnelStage } from "@/types/api";

/**
 * Bar tint per pipeline stage — token-based, cool→warm as the lead advances,
 * terminal states in good/bad.
 */
const STAGE_BARS: Record<string, string> = {
  new: "bg-chart-2",
  contacted: "bg-chart-2/80",
  site_visit_scheduled: "bg-chart-3",
  site_visit_done: "bg-chart-3/80",
  negotiation: "bg-accent",
  booking: "bg-chart-4",
  converted: "bg-chart-4",
  won: "bg-chart-4",
  lost: "bg-destructive/70",
};

function stageBar(stage: string): string {
  return STAGE_BARS[stage.toLowerCase()] ?? "bg-primary/60";
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
      <div className="space-y-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-5 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorBanner message="Could not load leads funnel." onRetry={onRetry} />;
  }

  if (!funnel || funnel.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No funnel data available.</p>
    );
  }

  const maxCount = Math.max(...funnel.map((s) => s.count), 1);
  const total = funnel.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-1.5">
      {funnel.map((stage) => {
        const pct = Math.round((stage.count / maxCount) * 100);
        const share = total > 0 ? Math.round((stage.count / total) * 100) : 0;
        return (
          <div key={stage.stage} className="flex items-center gap-2 text-xs">
            {/* `stageLabel` passes unmapped stages through raw (the funnel API
                can return stages outside our 7-stage enum) — `capitalize`
                keeps those readable. */}
            <span className="w-32 shrink-0 truncate capitalize text-muted-foreground">
              {stageLabel(stage.stage)}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-sm bg-muted">
              <div
                className={`h-full rounded-sm transition-all ${stageBar(stage.stage)}`}
                style={{ width: `${Math.max(pct, stage.count > 0 ? 2 : 0)}%` }}
                role="meter"
                aria-valuenow={stage.count}
                aria-valuemin={0}
                aria-valuemax={maxCount}
                aria-label={`${stageLabel(stage.stage)}: ${stage.count} leads`}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-mono font-semibold tabular-nums text-foreground">
              {stage.count}
            </span>
            <span className="w-10 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
              {share}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
