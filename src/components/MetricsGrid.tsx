"use client";

import * as React from "react";
import { MetricCard } from "@/components/MetricCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useMetrics } from "@/hooks/useMetrics";

export function MetricsGrid() {
  const { data, isLoading, isError, refetch, failedSlots } = useMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorBanner
        message="Failed to load dashboard metrics."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-3">
      {failedSlots.length > 0 ? (
        <ErrorBanner
          message={`Some metrics could not be loaded (${failedSlots.join(", ")}). Showing last good values where available.`}
          onRetry={() => refetch()}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Leads" value={data.totalLeads} />
        <MetricCard label="Hot Leads" value={data.hotLeads} />
        <MetricCard label="Bookings" value={data.bookings} />
        <MetricCard
          label="Units"
          value={
            (data.units.available ?? 0) +
            (data.units.blocked ?? 0) +
            (data.units.booked ?? 0)
          }
          subLabels={[
            { label: "available", value: data.units.available },
            { label: "blocked", value: data.units.blocked },
            { label: "booked", value: data.units.booked },
          ]}
        />
      </div>
    </div>
  );
}
