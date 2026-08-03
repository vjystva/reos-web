"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { TowerSidebar } from "@/components/TowerSidebar";
import { UnitGrid } from "@/components/UnitGrid";
import { UnitTable } from "@/components/UnitTable";
import { UnitSlideOver } from "@/components/UnitSlideOver";
import { CreateUnitForm } from "@/components/CreateUnitForm";
import { useProject } from "@/hooks/useProject";
import { useProjects } from "@/hooks/useProjects";
import { useTowers } from "@/hooks/useTowers";
import { useUnits } from "@/hooks/useUnits";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreateUnitMutation } from "@/hooks/useCreateUnitMutation";
import {
  UNIT_STATUS_BUCKETS,
  unitStatusBucketCounts,
  unitStatusDot,
  unitStatusLabel,
} from "@/lib/unitTone";
import { cn } from "@/lib/utils";
import type { Unit, CreateUnitRequest } from "@/types/api";

interface PageProps {
  params: { projectId: string };
}

/** Dense filter label recipe, shared with the other swept filter bars. */
const FILTER_LABEL =
  "flex flex-col gap-1 text-[11px] uppercase tracking-wider text-muted-foreground";

function ProjectSwitcher({ projectId }: { projectId: string }) {
  const router = useRouter();
  const projectsQ = useProjects({ pageSize: 100 });
  const projects = projectsQ.data?.data ?? [];

  return (
    <label className={FILTER_LABEL}>
      Project
      <Select
        value={projectId}
        onChange={(e) => router.push(`/dashboard/inventory/${e.target.value}`)}
        aria-label="Filter by project"
        disabled={projectsQ.isLoading || projects.length === 0}
      >
        {projects.length === 0 ? (
          <option value={projectId}>Loading…</option>
        ) : null}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

function FiltersBar({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const status = params.get("status") ?? "";
  const bedrooms = params.get("bedrooms") ?? "";
  const sortBy = params.get("sortBy") ?? "";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("unit");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div
      role="group"
      aria-label="Unit filters"
      className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card p-2 sm:grid-cols-3 lg:grid-cols-5"
    >
      <ProjectSwitcher projectId={projectId} />

      <label className={FILTER_LABEL}>
        Status
        <Select
          value={status}
          onChange={(e) => setParam("status", e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All</option>
          <option value="available">Available</option>
          <option value="on_hold">On hold</option>
          <option value="blocked">Blocked</option>
          <option value="booked">Booked</option>
          <option value="agreement_signed">Agreement signed</option>
          <option value="registered">Registered</option>
          <option value="handed_over">Handed over</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </label>

      <label className={FILTER_LABEL}>
        Bedrooms
        <Select
          value={bedrooms}
          onChange={(e) => setParam("bedrooms", e.target.value)}
          aria-label="Filter by bedrooms"
        >
          <option value="">Any</option>
          <option value="1">1 BHK</option>
          <option value="2">2 BHK</option>
          <option value="3">3 BHK</option>
          <option value="4">4 BHK</option>
          <option value="5">5+ BHK</option>
        </Select>
      </label>

      <label className={FILTER_LABEL}>
        Sort
        <Select
          value={sortBy}
          onChange={(e) => setParam("sortBy", e.target.value)}
          aria-label="Sort units"
        >
          <option value="">Default</option>
          <option value="price_asc">Price ascending</option>
          <option value="price_desc">Price descending</option>
          <option value="floor_asc">Floor ascending</option>
        </Select>
      </label>

      <div className={FILTER_LABEL}>
        Price range
        <PriceRange />
      </div>
    </div>
  );
}

function PriceRange() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [min, setMin] = React.useState(params.get("priceMin") ?? "");
  const [max, setMax] = React.useState(params.get("priceMax") ?? "");

  React.useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (min) next.set("priceMin", min);
      else next.delete("priceMin");
      if (max) next.set("priceMax", max);
      else next.delete("priceMax");
      next.delete("unit");
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);

  return (
    <div className="flex w-full gap-1.5">
      <Input
        type="number"
        value={min}
        onChange={(e) => setMin(e.target.value)}
        placeholder="Min ₹"
        aria-label="Minimum price"
        className="font-mono tabular-nums"
      />
      <Input
        type="number"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        placeholder="Max ₹"
        aria-label="Maximum price"
        className="font-mono tabular-nums"
      />
    </div>
  );
}

function ViewToggle({
  view,
  setView,
}: {
  view: "grid" | "table";
  setView: (v: "grid" | "table") => void;
}) {
  const item = (active: boolean) =>
    cn(
      "h-6 rounded-sm px-2 text-[11px] font-medium uppercase tracking-wider transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div
      role="group"
      aria-label="View toggle"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5"
    >
      <button
        type="button"
        onClick={() => setView("grid")}
        aria-pressed={view === "grid"}
        className={item(view === "grid")}
      >
        Grid
      </button>
      <button
        type="button"
        onClick={() => setView("table")}
        aria-pressed={view === "table"}
        className={item(view === "table")}
      >
        Table
      </button>
    </div>
  );
}

function ProjectDetailContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const towerId = params.get("tower");
  const unitParam = params.get("unit");
  const status = params.get("status") ?? "";
  const bedrooms = params.get("bedrooms") ?? "";
  const sortBy = params.get("sortBy") ?? "";
  const priceMin = params.get("priceMin") ?? "";
  const priceMax = params.get("priceMax") ?? "";
  const view: "grid" | "table" = params.get("view") === "table" ? "table" : "grid";

  function setView(v: "grid" | "table") {
    const next = new URLSearchParams(params.toString());
    next.set("view", v);
    router.push(`${pathname}?${next.toString()}`);
  }

  const projectQ = useProject(projectId);
  const isApartment = projectQ.data?.type === "apartment";
  const towersQ = useTowers(isApartment ? projectId : null);

  const { data: currentUser } = useCurrentUser();
  const canAddUnit =
    currentUser?.role === "builder_admin" || currentUser?.role === "admin";

  const [addOpen, setAddOpen] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const createUnit = useCreateUnitMutation(projectId);

  async function handleCreateUnit(data: CreateUnitRequest) {
    setAddError(null);
    try {
      await createUnit.mutateAsync(data);
      setAddOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add unit");
    }
  }

  // Wait for tower selection before fetching units on apartment projects
  // (avoids the BFF dispatching to /availability for an apartment with no
  // ?tower yet — per backend review N3).
  const unitsReady = isApartment ? Boolean(towerId) : projectQ.isSuccess;

  const unitsQ = useUnits(unitsReady ? projectId : null, {
    towerId: isApartment ? towerId : null,
    status,
    bedrooms,
    sortBy,
    priceMin,
    priceMax,
  });

  const units: Unit[] = React.useMemo(
    () => unitsQ.data?.data ?? [],
    [unitsQ.data],
  );
  const selectedUnit =
    unitParam ? units.find((u) => u.id === unitParam) ?? null : null;

  const unitsLoading = unitsQ.isLoading || (isApartment && !towerId);

  /**
   * Status counts are derived from the units currently loaded — there is no
   * per-project status-count endpoint — so they follow the active filters.
   * When a status filter is on, the caption below the tiles says so instead of
   * pretending the numbers are project-wide.
   */
  const buckets = React.useMemo(() => unitStatusBucketCounts(units), [units]);

  return (
    <div className="space-y-3">
      <PageHeader
        title={projectQ.data?.name ?? "Project"}
        subtitle={
          [projectQ.data?.city ?? projectQ.data?.location, projectQ.data?.type]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <>
            <Link
              href="/dashboard/inventory"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← All projects
            </Link>
            <PollIndicator
              isFetching={unitsQ.isFetching}
              isError={unitsQ.isError}
              dataUpdatedAt={unitsQ.dataUpdatedAt}
              onRetry={() => unitsQ.refetch()}
            />
            <ViewToggle view={view} setView={setView} />
            {canAddUnit ? (
              <Button
                onClick={() => {
                  setAddOpen(true);
                  setAddError(null);
                }}
              >
                + Add unit
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {buckets.map((b) => (
          <MetricCard
            key={b.key}
            label={b.label}
            value={unitsLoading ? null : b.count}
            hint={
              !unitsLoading && units.length > 0
                ? `${Math.round((b.count / units.length) * 100)}% of ${units.length} units`
                : undefined
            }
            isLoading={unitsLoading}
            isError={unitsQ.isError}
          />
        ))}
      </div>

      {status ? (
        <p className="text-[11px] text-muted-foreground">
          Counts reflect the active{" "}
          <span className="text-foreground">{unitStatusLabel(status)}</span>{" "}
          filter — clear it for the full project breakdown.
        </p>
      ) : null}

      {canAddUnit ? (
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add unit</SheetTitle>
              <SheetDescription>
                {isApartment
                  ? "Pick a tower and enter the unit details."
                  : "Enter the unit details for this project."}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <CreateUnitForm
                projectId={projectId}
                isApartment={isApartment}
                isSubmitting={createUnit.isPending}
                error={addError}
                onSubmit={(data) => void handleCreateUnit(data)}
                onCancel={() => setAddOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      <FiltersBar projectId={projectId} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <TowerSidebar
          towers={towersQ.data?.data ?? []}
          isLoading={isApartment && towersQ.isLoading}
          hidden={!isApartment}
        />

        <div className="min-w-0 flex-1 space-y-2">
          {unitsQ.isError ? (
            <ErrorBanner
              message="Could not load units."
              onRetry={() => unitsQ.refetch()}
            />
          ) : view === "table" ? (
            <UnitTable
              units={units}
              towers={towersQ.data?.data ?? []}
              projectName={projectQ.data?.name ?? null}
              isLoading={unitsLoading}
            />
          ) : (
            <UnitGrid units={units} isLoading={unitsLoading} />
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="uppercase tracking-wider">Legend</span>
            {UNIT_STATUS_BUCKETS.map((b) => (
              <span key={b.key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    unitStatusDot(b.statuses[0]),
                  )}
                />
                {b.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn("h-1.5 w-1.5 rounded-full", unitStatusDot("cancelled"))}
              />
              Cancelled
            </span>
          </div>
        </div>
      </div>

      <UnitSlideOver unit={selectedUnit} projectId={projectId} />
    </div>
  );
}

export default function ProjectDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <ProjectDetailContent projectId={params.projectId} />
    </Suspense>
  );
}
