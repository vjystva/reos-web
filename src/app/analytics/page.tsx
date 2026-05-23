"use client";

import * as React from "react";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";

// Date-range options (month granularity)
const MONTH_OPTIONS = [
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "Last 3 months", value: "last_3_months" },
  { label: "Last 6 months", value: "last_6_months" },
  { label: "This year", value: "this_year" },
] as const;

type MonthOption = (typeof MONTH_OPTIONS)[number]["value"];

function SkeletonCard() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="rounded-lg border border-slate-200 bg-white p-6"
    >
      <div className="mb-3 h-3 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mb-2 h-8 w-36 animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function formatInr(amount: number | null): string {
  if (amount === null) return "—";
  if (amount >= 1_00_00_000) {
    return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (amount >= 1_00_000) {
    return `₹${(amount / 1_00_000).toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatCount(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-IN");
}

function computeConversionRate(
  bookings: number | null,
  leads: number | null,
): string {
  if (bookings === null || leads === null || leads === 0) return "—";
  return `${((bookings / leads) * 100).toFixed(1)}%`;
}

export default function AnalyticsOverviewPage() {
  const [dateRange, setDateRange] = React.useState<MonthOption>("this_month");

  const { data, isLoading, isError, refetch } = useAnalyticsOverview();

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-900">
          Analytics Overview
        </h1>

        {/* Date range selector */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="date-range"
            className="text-xs font-medium text-slate-600"
          >
            Period
          </label>
          <select
            id="date-range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as MonthOption)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            {MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-3 text-sm text-red-600">
            Failed to load analytics overview.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Leads This Month"
            value={formatCount(data?.leadsThisMonth ?? null)}
            sub={`${formatCount(data?.totalLeads ?? null)} total`}
          />
          <KpiCard
            label="Bookings This Month"
            value={formatCount(data?.activeBookings ?? null)}
            sub={`${formatCount(data?.totalBookings ?? null)} total`}
          />
          <KpiCard
            label="Revenue This Month"
            value={formatInr(data?.collectedRevenue ?? null)}
            sub={`${formatInr(data?.totalRevenue ?? null)} total`}
          />
          <KpiCard
            label="Conversion Rate"
            value={computeConversionRate(
              data?.activeBookings ?? null,
              data?.leadsThisMonth ?? null,
            )}
            sub="bookings / leads this month"
          />
        </div>
      )}
    </div>
  );
}
