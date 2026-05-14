"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense } from "react";
import { MetricsGrid } from "@/components/MetricsGrid";
import { LeadKanban } from "@/components/LeadKanban";
import { LeadTable } from "@/components/LeadTable";
import { PollIndicator } from "@/components/PollIndicator";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useLeads } from "@/hooks/useLeads";

function ViewToggle({ view, setView }: { view: "kanban" | "table"; setView: (v: "kanban" | "table") => void }) {
  return (
    <div role="group" aria-label="View toggle" className="inline-flex rounded-md border border-slate-300 bg-white">
      <button
        type="button"
        onClick={() => setView("kanban")}
        aria-pressed={view === "kanban"}
        className={`px-3 py-1.5 text-sm ${view === "kanban" ? "bg-slate-900 text-white" : "text-slate-700"}`}
      >
        Kanban
      </button>
      <button
        type="button"
        onClick={() => setView("table")}
        aria-pressed={view === "table"}
        className={`px-3 py-1.5 text-sm ${view === "table" ? "bg-slate-900 text-white" : "text-slate-700"}`}
      >
        Table
      </button>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const viewParam = params.get("view");
  const view: "kanban" | "table" = viewParam === "table" ? "table" : "kanban";

  function setView(v: "kanban" | "table") {
    const next = new URLSearchParams(params.toString());
    next.set("view", v);
    router.push(`${pathname}?${next.toString()}`);
  }

  // For the home page show the first 50 leads (enough to populate the kanban).
  const leadsQuery = useLeads({ pageSize: 50 });

  return (
    <div className="space-y-6">
      <section>
        <h1 className="mb-3 text-xl font-semibold text-slate-900">Dashboard</h1>
        <MetricsGrid />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewToggle view={view} setView={setView} />
          <PollIndicator
            isFetching={leadsQuery.isFetching}
            isError={leadsQuery.isError}
            dataUpdatedAt={leadsQuery.dataUpdatedAt}
            onRetry={() => leadsQuery.refetch()}
          />
        </div>

        {leadsQuery.isError ? (
          <ErrorBanner
            message="Failed to load leads."
            onRetry={() => leadsQuery.refetch()}
          />
        ) : view === "kanban" ? (
          <LeadKanban
            leads={leadsQuery.data?.data ?? []}
            isLoading={leadsQuery.isLoading}
          />
        ) : (
          <>
            <LeadTable
              leads={(leadsQuery.data?.data ?? []).slice(0, 10)}
              isLoading={leadsQuery.isLoading}
              enableSort={false}
            />
            <div className="text-right">
              <Link
                href="/dashboard/pipeline"
                className="text-sm font-medium text-slate-700 hover:underline"
              >
                View all in Pipeline →
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-white" />}>
      <DashboardContent />
    </Suspense>
  );
}
