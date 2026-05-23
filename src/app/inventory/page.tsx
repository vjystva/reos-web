"use client";

import React, { useState } from "react";
import { useInventory, type InventoryFilters, type InventoryUnit } from "@/hooks/useInventory";
import { formatPriceINR } from "@/utils/priceFormat";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

interface FilterFormState {
  status: string;
  type: string;
  minPrice: string;
  maxPrice: string;
  floor: string;
}

const EMPTY_FORM: FilterFormState = {
  status: "",
  type: "",
  minPrice: "",
  maxPrice: "",
  floor: "",
};

function formToFilters(form: FilterFormState): InventoryFilters {
  const filters: InventoryFilters = {};
  if (form.status) filters.status = form.status;
  if (form.type) filters.type = form.type;
  if (form.minPrice !== "") filters.minPrice = Number(form.minPrice);
  if (form.maxPrice !== "") filters.maxPrice = Number(form.maxPrice);
  if (form.floor !== "") filters.floor = Number(form.floor);
  return filters;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const normalised = status?.toLowerCase();
  let className =
    "inline-block rounded-full px-2 py-0.5 text-xs font-semibold ";
  if (normalised === "available") {
    className += "bg-green-100 text-green-800";
  } else if (normalised === "reserved") {
    className += "bg-yellow-100 text-yellow-800";
  } else if (normalised === "sold") {
    className += "bg-red-100 text-red-800";
  } else {
    className += "bg-gray-100 text-gray-700";
  }
  return <span className={className}>{status}</span>;
}

// ---------------------------------------------------------------------------
// Unit card
// ---------------------------------------------------------------------------

function UnitCard({ unit }: { unit: InventoryUnit }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900">
          {unit.unitNumber ?? "—"}
        </span>
        <StatusBadge status={unit.status} />
      </div>
      <dl className="mt-2 space-y-1 text-sm text-gray-600">
        <div className="flex justify-between">
          <dt>Type</dt>
          <dd className="font-medium text-gray-800">{unit.type ?? "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Floor</dt>
          <dd className="font-medium text-gray-800">
            {unit.floor != null ? unit.floor : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Price</dt>
          <dd className="font-semibold text-gray-900">
            {unit.price != null ? formatPriceINR(unit.price) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-gray-200" />
        <div className="h-5 w-16 rounded-full bg-gray-200" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-3/4 rounded bg-gray-100" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const [form, setForm] = useState<FilterFormState>(EMPTY_FORM);
  const [appliedFilters, setAppliedFilters] = useState<InventoryFilters>({});

  const { data, isLoading, isError, refetch } = useInventory(appliedFilters);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setAppliedFilters(formToFilters(form));
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setAppliedFilters({});
  }

  const units = data?.units ?? [];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Unit Inventory</h1>

      {/* Filter bar */}
      <form
        onSubmit={handleApply}
        className="mb-8 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        {/* Status */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="status"
            className="text-xs font-medium text-gray-600"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            value={form.status}
            onChange={handleChange}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="available">available</option>
            <option value="reserved">reserved</option>
            <option value="sold">sold</option>
          </select>
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-xs font-medium text-gray-600">
            Type
          </label>
          <select
            id="type"
            name="type"
            value={form.type}
            onChange={handleChange}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="1BHK">1BHK</option>
            <option value="2BHK">2BHK</option>
            <option value="3BHK">3BHK</option>
            <option value="4BHK">4BHK</option>
            <option value="Penthouse">Penthouse</option>
          </select>
        </div>

        {/* Min price */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="minPrice"
            className="text-xs font-medium text-gray-600"
          >
            Min Price (₹)
          </label>
          <input
            id="minPrice"
            name="minPrice"
            type="number"
            min={0}
            value={form.minPrice}
            onChange={handleChange}
            placeholder="e.g. 5000000"
            className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Max price */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="maxPrice"
            className="text-xs font-medium text-gray-600"
          >
            Max Price (₹)
          </label>
          <input
            id="maxPrice"
            name="maxPrice"
            type="number"
            min={0}
            value={form.maxPrice}
            onChange={handleChange}
            placeholder="e.g. 20000000"
            className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Floor */}
        <div className="flex flex-col gap-1">
          <label htmlFor="floor" className="text-xs font-medium text-gray-600">
            Floor
          </label>
          <input
            id="floor"
            name="floor"
            type="number"
            min={0}
            value={form.floor}
            onChange={handleChange}
            placeholder="e.g. 3"
            className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Error banner */}
      {isError && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Failed to load inventory. Please try again.</span>
          <button
            onClick={() => refetch()}
            className="ml-4 rounded-md bg-red-100 px-3 py-1 text-xs font-medium hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && units.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
          No units match your filters
        </div>
      )}

      {/* Unit grid */}
      {!isLoading && units.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </div>
  );
}
