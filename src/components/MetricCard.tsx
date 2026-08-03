import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: number | string | null | undefined;
  subLabels?: { label: string; value: number | string | null | undefined }[];
  /** Optional muted hint line rendered under the value. */
  hint?: React.ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  className?: string;
}

/**
 * Dense KPI tile — Meridian OS recipe: uppercase micro-label, mono tabular
 * value, optional muted hint / sub-label row.
 */
export function MetricCard({
  label,
  value,
  subLabels,
  hint,
  isLoading,
  isError,
  className,
}: MetricCardProps) {
  return (
    <div
      aria-label={`${label}: ${value ?? "unavailable"}`}
      className={cn(
        "rounded-md border border-border bg-card px-3 py-2.5",
        className,
      )}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

      {isLoading ? (
        <Skeleton className="mt-1.5 h-6 w-3/5" />
      ) : isError || value == null ? (
        <div className="mt-1 text-xs text-muted-foreground">Unavailable</div>
      ) : (
        <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
      )}

      {hint ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      ) : null}

      {subLabels && subLabels.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {subLabels.map((sl, i) => (
            <span key={i}>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {sl.value ?? "—"}
              </span>{" "}
              {sl.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
