"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import { LeadsFunnelChart } from "@/components/LeadsFunnelChart";
import { RevenueTrendChart } from "@/components/RevenueTrendChart";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { useLeadsFunnel } from "@/hooks/useLeadsFunnel";
import { useRevenueTrend } from "@/hooks/useRevenueTrend";
import { formatCurrency } from "@/lib/formatCurrency";

export default function AnalyticsPage() {
  const overviewQuery = useAnalyticsOverview();
  const funnelQuery = useLeadsFunnel();
  const trendQuery = useRevenueTrend();

  const ov = overviewQuery.data;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>

      {/* Overview metrics */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard
            label="Total Leads"
            value={ov?.totalLeads ?? null}
            subLabels={[
              { label: "This month", value: ov?.leadsThisMonth ?? null },
              { label: "Hot", value: ov?.hotLeads ?? null },
            ]}
            isLoading={overviewQuery.isLoading}
            isError={overviewQuery.isError}
          />
          <MetricCard
            label="Bookings"
            value={ov?.totalBookings ?? null}
            subLabels={[
              { label: "Active", value: ov?.activeBookings ?? null },
            ]}
            isLoading={overviewQuery.isLoading}
            isError={overviewQuery.isError}
          />
          <MetricCard
            label="Revenue"
            value={ov?.totalRevenue != null ? formatCurrency(ov.totalRevenue) : null}
            subLabels={[
              {
                label: "Collected",
                value: ov?.collectedRevenue != null ? formatCurrency(ov.collectedRevenue) : null,
              },
              {
                label: "Pending",
                value: ov?.pendingRevenue != null ? formatCurrency(ov.pendingRevenue) : null,
              },
            ]}
            isLoading={overviewQuery.isLoading}
            isError={overviewQuery.isError}
          />
          <MetricCard
            label="Units"
            value={ov?.totalUnits ?? null}
            subLabels={[
              { label: "Available", value: ov?.availableUnits ?? null },
              { label: "Booked", value: ov?.bookedUnits ?? null },
            ]}
            isLoading={overviewQuery.isLoading}
            isError={overviewQuery.isError}
          />
        </div>
      </section>

      {/* Leads funnel */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadsFunnelChart
              funnel={funnelQuery.data?.funnel}
              isLoading={funnelQuery.isLoading}
              isError={funnelQuery.isError}
              onRetry={() => void funnelQuery.refetch()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend (12 months)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <RevenueTrendChart
              trend={trendQuery.data?.trend}
              isLoading={trendQuery.isLoading}
              isError={trendQuery.isError}
              onRetry={() => void trendQuery.refetch()}
            />
          </CardContent>
        </Card>
      </div>

      {/* Pending site visits */}
      {ov?.pendingSiteVisits != null && (
        <p className="text-sm text-slate-500">
          Pending site visits: <strong>{ov.pendingSiteVisits}</strong>
        </p>
      )}
    </div>
  );
}
