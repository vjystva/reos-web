"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LeadTable } from "@/components/LeadTable";
import { LeadKanban } from "@/components/LeadKanban";
import { PipelineFilters } from "@/components/PipelineFilters";
import { LeadSlideOver } from "@/components/LeadSlideOver";
import { PollIndicator } from "@/components/PollIndicator";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Button } from "@/components/ui/button";
import { useLeads } from "@/hooks/useLeads";

const PAGE_SIZE = 10;

function ViewToggle({
  view,
  setView,
}: {
  view: "table" | "kanban";
  setView: (v: "table" | "kanban") => void;
}) {
  return (
    <div role="group" aria-label="View toggle" className="inline-flex rounded-md border border-slate-300 bg-white">
      <button
        type="button"
        onClick={() => setView("table")}
        aria-pressed={view === "table"}
        className={`px-3 py-1.5 text-sm ${view === "table" ? "bg-slate-900 text-white" : "text-slate-700"}`}
      >
        Table
      </button>
      <button
        type="button"
        onClick={() => setView("kanban")}
        aria-pressed={view === "kanban"}
        className={`px-3 py-1.5 text-sm ${view === "kanban" ? "bg-slate-900 text-white" : "text-slate-700"}`}
      >
        Kanban
      </button>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goto(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between text-sm text-slate-600"
    >
      <span>
        Page {page} of {totalPages} · {total} leads
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => goto(page - 1)}
          aria-label="Previous page"
        >
          ←
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => goto(page + 1)}
          aria-label="Next page"
        >
          →
        </Button>
      </div>
    </nav>
  );
}

function PipelineContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const stage = params.get("stage") ?? "";
  const temperature = params.get("temperature") ?? "";
  const dealer = params.get("dealer") ?? "";
  const search = params.get("search") ?? "";
  const sort = params.get("sort") ?? "";
  const order = params.get("order") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;
  const viewParam = params.get("view");
  const view: "table" | "kanban" = viewParam === "kanban" ? "kanban" : "table";

  function setView(v: "table" | "kanban") {
    const next = new URLSearchParams(params.toString());
    next.set("view", v);
    router.push(`${pathname}?${next.toString()}`);
  }

  const leadsQuery = useLeads({
    stage,
    temperature,
    dealer,
    search,
    sort,
    order,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Lead Pipeline</h1>
        <PollIndicator
          isFetching={leadsQuery.isFetching}
          isError={leadsQuery.isError}
          dataUpdatedAt={leadsQuery.dataUpdatedAt}
          onRetry={() => leadsQuery.refetch()}
        />
      </div>

      <PipelineFilters />

      <div className="flex justify-end">
        <ViewToggle view={view} setView={setView} />
      </div>

      {leadsQuery.isError ? (
        <ErrorBanner
          message="Failed to load leads."
          onRetry={() => leadsQuery.refetch()}
        />
      ) : view === "table" ? (
        <>
          <LeadTable
            leads={leadsQuery.data?.data ?? []}
            isLoading={leadsQuery.isLoading}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={leadsQuery.data?.total ?? 0}
          />
        </>
      ) : (
        <LeadKanban
          leads={leadsQuery.data?.data ?? []}
          isLoading={leadsQuery.isLoading}
        />
      )}

      <LeadSlideOver />
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-64 animate-pulse rounded-md bg-white" />
        </div>
      }
    >
      <PipelineContent />
    </Suspense>
  );
}
