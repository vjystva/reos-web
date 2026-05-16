"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { TowerSidebar } from "@/components/TowerSidebar";
import { UnitGrid } from "@/components/UnitGrid";
import { UnitSlideOver } from "@/components/UnitSlideOver";
import { useProject } from "@/hooks/useProject";
import { useTowers } from "@/hooks/useTowers";
import { useUnits } from "@/hooks/useUnits";
import type { Unit } from "@/types/api";

interface PageProps {
  params: { projectId: string };
}

function FiltersBar() {
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
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Status
        <Select
          value={status}
          onChange={(e) => setParam("status", e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All</option>
          <option value="available">Available</option>
          <option value="blocked">Blocked</option>
          <option value="booked">Booked</option>
          <option value="sold">Sold</option>
          <option value="held">Held</option>
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
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
      <label className="flex flex-col gap-1 text-xs text-slate-600">
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
      <div className="col-span-2 sm:col-span-1 flex items-end gap-2">
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
    <div className="flex w-full gap-2">
      <Input
        type="number"
        value={min}
        onChange={(e) => setMin(e.target.value)}
        placeholder="Min ₹"
        aria-label="Minimum price"
      />
      <Input
        type="number"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        placeholder="Max ₹"
        aria-label="Maximum price"
      />
    </div>
  );
}

function ProjectDetailContent({ projectId }: { projectId: string }) {
  const params = useSearchParams();
  const towerId = params.get("tower");
  const unitParam = params.get("unit");
  const status = params.get("status") ?? "";
  const bedrooms = params.get("bedrooms") ?? "";
  const sortBy = params.get("sortBy") ?? "";
  const priceMin = params.get("priceMin") ?? "";
  const priceMax = params.get("priceMax") ?? "";

  const projectQ = useProject(projectId);
  const isApartment = projectQ.data?.type === "apartment";
  const towersQ = useTowers(isApartment ? projectId : null);

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

  const units: Unit[] = unitsQ.data?.data ?? [];
  const selectedUnit =
    unitParam ? units.find((u) => u.id === unitParam) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/inventory"
            className="text-sm text-slate-500 hover:underline"
          >
            ← All projects
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">
            {projectQ.data?.name ?? "Project"}
          </h1>
          {projectQ.data?.city ? (
            <p className="text-sm text-slate-500">{projectQ.data.city}</p>
          ) : null}
        </div>
        <PollIndicator
          isFetching={unitsQ.isFetching}
          isError={unitsQ.isError}
          dataUpdatedAt={unitsQ.dataUpdatedAt}
          onRetry={() => unitsQ.refetch()}
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <TowerSidebar
          towers={towersQ.data?.data ?? []}
          isLoading={isApartment && towersQ.isLoading}
          hidden={!isApartment}
        />

        <div className="flex-1 space-y-3">
          <FiltersBar />

          {unitsQ.isError ? (
            <ErrorBanner
              message="Could not load units."
              onRetry={() => unitsQ.refetch()}
            />
          ) : (
            <UnitGrid
              units={units}
              isLoading={unitsQ.isLoading || (isApartment && !towerId)}
            />
          )}

          <p className="text-xs text-slate-500">
            Legend: <span className="font-medium text-green-700">●</span> Available{" "}
            <span className="font-medium text-amber-600">●</span> Blocked{" "}
            <span className="font-medium text-blue-700">●</span> Booked{" "}
            <span className="font-medium text-slate-400">●</span> Other
          </p>
        </div>
      </div>

      <UnitSlideOver unit={selectedUnit} />
    </div>
  );
}

export default function ProjectDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-64 animate-pulse rounded-md bg-white" />
        </div>
      }
    >
      <ProjectDetailContent projectId={params.projectId} />
    </Suspense>
  );
}
