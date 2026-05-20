"use client";

import * as React from "react";
import { useLeadsBySource } from "@/hooks/useLeadsBySource";
import { useBookingsByProject } from "@/hooks/useBookingsByProject";
import { usePaymentsByMonth } from "@/hooks/usePaymentsByMonth";
import { useConversionFunnel } from "@/hooks/useConversionFunnel";

const CURRENT_YEAR = new Date().getFullYear();

export default function AnalyticsDeepDivePage() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [year, setYear] = React.useState(CURRENT_YEAR);

  const dateRange =
    from && to ? { from, to } : undefined;

  const leadsBySourceQuery = useLeadsBySource(dateRange);
  const bookingsByProjectQuery = useBookingsByProject();
  const paymentsByMonthQuery = usePaymentsByMonth(year);
  const conversionFunnelQuery = useConversionFunnel();

  const yearOptions = React.useMemo(() => {
    const years: number[] = [];
    for (let y = CURRENT_YEAR; y >= CURRENT_YEAR - 4; y--) {
      years.push(y);
    }
    return years;
  }, []);

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-xl font-semibold text-slate-900">
        Analytics Deep Dive
      </h1>

      {/* Date range selector */}
      <section className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="date-from"
            className="text-xs font-medium text-slate-600"
          >
            From
          </label>
          <input
            id="date-from"
            type="text"
            placeholder="YYYY-MM-DD"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="date-to"
            className="text-xs font-medium text-slate-600"
          >
            To
          </label>
          <input
            id="date-to"
            type="text"
            placeholder="YYYY-MM-DD"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Leads by source */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Leads by Source
          </h2>
          {leadsBySourceQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : leadsBySourceQuery.isError ? (
            <p className="text-sm text-red-500">
              Failed to load leads by source.{" "}
              <button
                type="button"
                onClick={() => void leadsBySourceQuery.refetch()}
                className="underline"
              >
                Retry
              </button>
            </p>
          ) : !leadsBySourceQuery.data?.data.length ? (
            <p className="text-sm text-slate-400">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="pb-1 pr-4 font-medium">Source</th>
                  <th className="pb-1 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {leadsBySourceQuery.data.data.map((row) => (
                  <tr key={row.source} className="border-b last:border-0">
                    <td className="py-1.5 pr-4">{row.source}</td>
                    <td className="py-1.5">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Bookings by project */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Bookings by Project
          </h2>
          {bookingsByProjectQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : bookingsByProjectQuery.isError ? (
            <p className="text-sm text-red-500">
              Failed to load bookings by project.{" "}
              <button
                type="button"
                onClick={() => void bookingsByProjectQuery.refetch()}
                className="underline"
              >
                Retry
              </button>
            </p>
          ) : !bookingsByProjectQuery.data?.data.length ? (
            <p className="text-sm text-slate-400">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="pb-1 pr-4 font-medium">Project</th>
                  <th className="pb-1 font-medium">Bookings</th>
                  <th className="pb-1 pl-4 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bookingsByProjectQuery.data.data.map((row) => (
                  <tr key={row.projectId} className="border-b last:border-0">
                    <td className="py-1.5 pr-4">{row.projectName}</td>
                    <td className="py-1.5">{row.bookingCount}</td>
                    <td className="py-1.5 pl-4">
                      {row.totalRevenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Payments by month */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Payments by Month
            </h2>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {paymentsByMonthQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : paymentsByMonthQuery.isError ? (
            <p className="text-sm text-red-500">
              Failed to load payments by month.{" "}
              <button
                type="button"
                onClick={() => void paymentsByMonthQuery.refetch()}
                className="underline"
              >
                Retry
              </button>
            </p>
          ) : !paymentsByMonthQuery.data?.data.length ? (
            <p className="text-sm text-slate-400">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="pb-1 pr-4 font-medium">Month</th>
                  <th className="pb-1 font-medium">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentsByMonthQuery.data.data.map((row) => (
                  <tr
                    key={`${row.year}-${row.month}`}
                    className="border-b last:border-0"
                  >
                    <td className="py-1.5 pr-4">
                      {row.year}-{String(row.month).padStart(2, "0")}
                    </td>
                    <td className="py-1.5">
                      {row.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Conversion funnel */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Conversion Funnel
          </h2>
          {conversionFunnelQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : conversionFunnelQuery.isError ? (
            <p className="text-sm text-red-500">
              Failed to load conversion funnel.{" "}
              <button
                type="button"
                onClick={() => void conversionFunnelQuery.refetch()}
                className="underline"
              >
                Retry
              </button>
            </p>
          ) : !conversionFunnelQuery.data?.stages.length ? (
            <p className="text-sm text-slate-400">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="pb-1 pr-4 font-medium">Stage</th>
                  <th className="pb-1 pr-4 font-medium">Count</th>
                  <th className="pb-1 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {conversionFunnelQuery.data.stages.map((stage) => (
                  <tr key={stage.stage} className="border-b last:border-0">
                    <td className="py-1.5 pr-4">{stage.stage}</td>
                    <td className="py-1.5 pr-4">{stage.count}</td>
                    <td className="py-1.5">
                      {(stage.conversionRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
