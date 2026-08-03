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
import { PageHeader } from "@/components/PageHeader";
import { CreateLeadForm } from "@/components/CreateLeadForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLeads } from "@/hooks/useLeads";
import { useCreateLeadMutation } from "@/hooks/useCreateLeadMutation";
import type { CreateLeadRequest } from "@/types/api";

const PAGE_SIZE = 10;

function ViewToggle({
  view,
  setView,
}: {
  view: "table" | "kanban";
  setView: (v: "table" | "kanban") => void;
}) {
  const item = (active: boolean) =>
    `h-6 rounded-sm px-2 text-[11px] font-medium uppercase tracking-wider transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div
      role="group"
      aria-label="View toggle"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5"
    >
      <button
        type="button"
        onClick={() => setView("table")}
        aria-pressed={view === "table"}
        className={item(view === "table")}
      >
        Table
      </button>
      <button
        type="button"
        onClick={() => setView("kanban")}
        aria-pressed={view === "kanban"}
        className={item(view === "kanban")}
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
      className="flex items-center justify-between text-[11px] text-muted-foreground"
    >
      <span>
        Page{" "}
        <span className="font-mono tabular-nums text-foreground">{page}</span> of{" "}
        <span className="font-mono tabular-nums text-foreground">{totalPages}</span>{" "}
        · <span className="font-mono tabular-nums text-foreground">{total}</span>{" "}
        leads
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

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

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
    assignedDealerId: dealer,
    q: search,
    sortBy: sort,
    sortOrder: order,
    page,
    pageSize: PAGE_SIZE,
  });

  const createMutation = useCreateLeadMutation();

  async function handleCreate(data: CreateLeadRequest) {
    setFormError(null);
    try {
      await createMutation.mutateAsync(data);
      setSheetOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create lead");
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Lead Pipeline"
        subtitle={`${leadsQuery.data?.total ?? 0} leads total`}
        actions={
          <>
            <PollIndicator
              isFetching={leadsQuery.isFetching}
              isError={leadsQuery.isError}
              dataUpdatedAt={leadsQuery.dataUpdatedAt}
              onRetry={() => leadsQuery.refetch()}
            />
            <ViewToggle view={view} setView={setView} />
            <Button onClick={() => { setSheetOpen(true); setFormError(null); }}>
              + Add lead
            </Button>
          </>
        }
      />

      <PipelineFilters />

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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add new lead</SheetTitle>
            <SheetDescription>
              Capture customer details and lead source.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-2">
            <CreateLeadForm
              isSubmitting={createMutation.isPending}
              error={formError}
              onSubmit={(data) => void handleCreate(data)}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PipelineContent />
    </Suspense>
  );
}
