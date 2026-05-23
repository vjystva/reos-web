"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useProjectUnits, type ProjectUnitsFilters } from "@/hooks/useProjectUnits";
import type { Unit } from "@/types/api";

// --- Status badge -----------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  blocked: "bg-yellow-100 text-yellow-800",
  booked: "bg-blue-100 text-blue-800",
  sold: "bg-red-100 text-red-800",
  held: "bg-purple-100 text-purple-800",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${color}`}
    >
      {status}
    </span>
  );
}

// --- Unit card --------------------------------------------------------------

function UnitCard({ unit }: { unit: Unit }) {
  const areaSqft = unit.areaSqft ?? unit.area;
  const price = unit.listPrice ?? unit.effectivePrice;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-slate-900">
          {unit.unitNumber ?? unit.id}
        </span>
        <StatusBadge status={unit.status ?? "unknown"} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
        <div>
          <dt className="text-xs text-slate-400">Floor</dt>
          <dd>{unit.floor ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Bedrooms</dt>
          <dd>{unit.bedrooms ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Area (sqft)</dt>
          <dd>{areaSqft != null ? areaSqft.toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Price</dt>
          <dd>
            {price != null
              ? `₹${price.toLocaleString("en-IN")}`
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// --- Filters ----------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "available", label: "Available" },
  { value: "blocked", label: "Blocked" },
  { value: "booked", label: "Booked" },
  { value: "sold", label: "Sold" },
] as const;

interface FiltersBarProps {
  filters: ProjectUnitsFilters;
  floors: number[];
  onChange: (f: ProjectUnitsFilters) => void;
}

function FiltersBar({ filters, floors, onChange }: FiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-1.5 text-sm text-slate-700">
        Status
        <select
          value={filters.status ?? ""}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value || undefined })
          }
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-sm text-slate-700">
        Floor
        <select
          value={filters.floor != null ? String(filters.floor) : ""}
          onChange={(e) =>
            onChange({
              ...filters,
              floor: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by floor"
        >
          <option value="">All</option>
          {floors.map((f) => (
            <option key={f} value={f}>
              Floor {f}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// --- Skeleton ---------------------------------------------------------------

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-lg bg-slate-200"
        />
      ))}
    </div>
  );
}

// --- Main content -----------------------------------------------------------

function InventoryContent({ projectId }: { projectId: string }) {
  const [filters, setFilters] = React.useState<ProjectUnitsFilters>({});
  const { data, isLoading, isError, refetch } = useProjectUnits(projectId, filters);

  const units = data?.data ?? [];

  // Derive sorted unique floor numbers from ALL loaded units (unfiltered by floor
  // so the dropdown stays stable). We re-query without floor filter to get all
  // floors only when a floor is already selected — simpler: derive from full data
  // that was fetched when floor filter was cleared.
  const allFloors = React.useMemo(() => {
    const floorSet = new Set<number>();
    units.forEach((u) => {
      if (u.floor != null) floorSet.add(u.floor);
    });
    return Array.from(floorSet).sort((a, b) => a - b);
  }, [units]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">
          Project Inventory
        </h1>
        {data != null && (
          <span className="text-sm text-slate-500">
            {data.total} unit{data.total !== 1 ? "s" : ""} total
          </span>
        )}
      </div>

      <FiltersBar filters={filters} floors={allFloors} onChange={setFilters} />

      {isError ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Could not load units.{" "}
          <button
            onClick={() => refetch()}
            className="underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <GridSkeleton />
      ) : units.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No units match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Page -------------------------------------------------------------------

export default function ProjectInventoryPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;

  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <GridSkeleton />
        </div>
      }
    >
      {projectId ? (
        <InventoryContent projectId={projectId} />
      ) : (
        <div className="text-sm text-slate-500">No project selected.</div>
      )}
    </Suspense>
  );
}
