import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardProps {
  label: string;
  value: number | string | null | undefined;
  subLabels?: { label: string; value: number | string | null | undefined }[];
  isLoading?: boolean;
  isError?: boolean;
}

export function MetricCard({
  label,
  value,
  subLabels,
  isLoading,
  isError,
}: MetricCardProps) {
  return (
    <Card aria-label={`${label}: ${value ?? "unavailable"}`}>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-3/5" />
        ) : isError || value == null ? (
          <span className="text-sm text-slate-400">Unavailable</span>
        ) : (
          <div className="text-3xl font-bold text-slate-900">{value}</div>
        )}
        {subLabels && subLabels.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {subLabels.map((sl, i) => (
              <span key={i}>
                <span className="font-semibold text-slate-700">
                  {sl.value ?? "—"}
                </span>{" "}
                {sl.label}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
