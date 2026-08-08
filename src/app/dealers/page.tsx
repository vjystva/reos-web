"use client";

import * as React from "react";
import { useDealers } from "@/hooks/useDealers";
import { useDealersPerformance } from "@/hooks/useDealersPerformance";
import { useCreateDealerMutation } from "@/hooks/useCreateDealerMutation";
import { useDeactivateDealerMutation } from "@/hooks/useDeactivateDealerMutation";
import {
  CreateDealerRequestSchema,
  type Dealer,
  type DealerPerformance,
} from "@/types/api";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Dealer["status"] }) {
  const styles: Record<Dealer["status"], string> = {
    active: "bg-green-100 text-green-700",
    inactive: "bg-gray-100 text-gray-500",
    suspended: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-500"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add Dealer Modal
// ---------------------------------------------------------------------------

interface AddDealerModalProps {
  onClose: () => void;
}

function AddDealerModal({ onClose }: AddDealerModalProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const create = useCreateDealerMutation();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // `email` is required by the backend (`CreateDealerDto.email` is
    // `@IsEmail()`, `dealers.email` is NOT NULL) — pass it through as-is so a
    // blank value surfaces "Email required" here instead of a backend 400.
    const result = CreateDealerRequestSchema.safeParse({
      name,
      email,
      phone: phone || undefined,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Validation error");
      return;
    }
    create.mutate(result.data, {
      onSuccess: onClose,
      onError: (err) => setError(err.message),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Add Dealer</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Realty"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full rounded border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dealer@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Phone</label>
            <input
              type="tel"
              className="w-full rounded border px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create dealer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Performance table
// ---------------------------------------------------------------------------

type SortKey = "leadCount" | "bookingCount" | "conversionRate" | "revenue";

function PerformanceTable({
  rows,
}: {
  rows: DealerPerformance[];
}) {
  const [sortKey, setSortKey] = React.useState<SortKey>("leadCount");
  const [sortAsc, setSortAsc] = React.useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = React.useMemo(() => {
    return [...rows].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
  }, [rows, sortKey, sortAsc]);

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>;
  }

  const headerCls =
    "cursor-pointer select-none px-4 py-3 text-left text-sm font-medium text-gray-600 hover:text-gray-900";

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
              Dealer
            </th>
            <th
              className={headerCls}
              onClick={() => handleSort("leadCount")}
            >
              Leads <SortArrow col="leadCount" />
            </th>
            <th
              className={headerCls}
              onClick={() => handleSort("bookingCount")}
            >
              Bookings <SortArrow col="bookingCount" />
            </th>
            <th
              className={headerCls}
              onClick={() => handleSort("conversionRate")}
            >
              Conversion <SortArrow col="conversionRate" />
            </th>
            <th
              className={headerCls}
              onClick={() => handleSort("revenue")}
            >
              Revenue <SortArrow col="revenue" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((row) => (
            <tr key={row.dealerId} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{row.dealerName}</td>
              <td className="px-4 py-3">{row.leadCount}</td>
              <td className="px-4 py-3">{row.bookingCount}</td>
              <td className="px-4 py-3">
                {(row.conversionRate * 100).toFixed(1)}%
              </td>
              <td className="px-4 py-3">
                {new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(row.revenue)}
              </td>
            </tr>
          ))}
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-gray-400"
              >
                No performance data available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dealer list row
// ---------------------------------------------------------------------------

interface DealerRowProps {
  dealer: Dealer;
  projectCount: number;
  onDeactivate: (id: string, name: string) => void;
  isDeactivating: boolean;
}

function DealerRow({
  dealer,
  projectCount,
  onDeactivate,
  isDeactivating,
}: DealerRowProps) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium">{dealer.name}</td>
      <td className="px-4 py-3">
        <StatusBadge status={dealer.status} />
      </td>
      <td className="px-4 py-3 text-gray-500">{projectCount}</td>
      <td className="px-4 py-3">
        {dealer.email ? (
          <span className="text-gray-600">{dealer.email}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onDeactivate(dealer.id, dealer.name)}
          disabled={isDeactivating || dealer.status === "inactive"}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Deactivate
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DealersPage() {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [deactivateError, setDeactivateError] = React.useState<string | null>(
    null,
  );

  const dealersQuery = useDealers();
  const performanceQuery = useDealersPerformance();
  const deactivateMutation = useDeactivateDealerMutation();

  const dealers = dealersQuery.data?.dealers ?? [];

  async function handleDeactivate(dealerId: string, name: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Deactivate dealer "${name}"? They will no longer be assigned new leads.`,
      )
    ) {
      return;
    }
    setDeactivateError(null);
    try {
      await deactivateMutation.mutateAsync({ dealerId });
    } catch (err) {
      setDeactivateError(
        err instanceof Error ? err.message : "Failed to deactivate dealer",
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dealer Portal</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage dealers, view performance, and track conversions.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Dealer
        </button>
      </div>

      {deactivateError ? (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deactivateError}
        </div>
      ) : null}

      {/* Dealer list */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Dealers</h2>
        {dealersQuery.isError ? (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load dealers.{" "}
            <button
              onClick={() => void dealersQuery.refetch()}
              className="underline"
            >
              Retry
            </button>
          </div>
        ) : dealersQuery.isLoading ? (
          <p className="text-sm text-gray-400">Loading dealers…</p>
        ) : dealers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center text-sm text-gray-400">
            No dealers found. Click &quot;Add Dealer&quot; to get started.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Projects
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dealers.map((dealer) => (
                  <DealerRow
                    key={dealer.id}
                    dealer={dealer}
                    projectCount={0}
                    onDeactivate={(id, name) =>
                      void handleDeactivate(id, name)
                    }
                    isDeactivating={deactivateMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Performance table */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          Performance
        </h2>
        {performanceQuery.isError ? (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load performance data.{" "}
            <button
              onClick={() => void performanceQuery.refetch()}
              className="underline"
            >
              Retry
            </button>
          </div>
        ) : performanceQuery.isLoading ? (
          <p className="text-sm text-gray-400">Loading performance…</p>
        ) : (
          <PerformanceTable rows={performanceQuery.data ?? []} />
        )}
      </section>

      {/* Add dealer modal */}
      {showAddModal ? (
        <AddDealerModal onClose={() => setShowAddModal(false)} />
      ) : null}
    </div>
  );
}
