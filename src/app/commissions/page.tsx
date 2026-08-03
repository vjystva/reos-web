"use client";

import React, { useState } from "react";
import { useCommissions, formatCommissionStatus, commissionStatusClass, totalByStatus } from "@/hooks/useCommissions";
import type { Commission } from "@/types/api";

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${commissionStatusClass(status)}`}>
      {formatCommissionStatus(status)}
    </span>
  );
}

function CommissionRow({ c }: { c: Commission }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 text-sm text-gray-900 font-mono">{c.id.slice(0, 8)}</td>
      <td className="py-3 px-4 text-sm text-gray-700">{c.bookingId.slice(0, 8)}</td>
      <td className="py-3 px-4 text-sm text-gray-700">{c.rate}%</td>
      <td className="py-3 px-4 text-sm text-gray-900 font-semibold">{formatINR(parseFloat(c.amount))}</td>
      <td className="py-3 px-4"><StatusBadge status={c.status} /></td>
      <td className="py-3 px-4 text-sm text-gray-500">{c.paidAt ? new Date(c.paidAt).toLocaleDateString() : "—"}</td>
    </tr>
  );
}

type StatusFilter = "all" | "pending" | "approved" | "paid" | "cancelled";

export default function CommissionsPage() {
  const { data, isLoading, error } = useCommissions();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const commissions = data ?? [];
  const filtered = filter === "all" ? commissions : commissions.filter((c) => c.status === filter);

  const totalAll = commissions.reduce((s, c) => s + parseFloat(c.amount), 0);
  const totalPending = totalByStatus(commissions, "pending") + totalByStatus(commissions, "approved");
  const totalPaid = totalByStatus(commissions, "paid");

  // Padding comes from AppShell's content column (p-4).
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Commissions</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Total" value={formatINR(totalAll)} color="border-blue-200 bg-blue-50" />
        <SummaryCard label="Pending / Approved" value={formatINR(totalPending)} color="border-yellow-200 bg-yellow-50" />
        <SummaryCard label="Paid Out" value={formatINR(totalPaid)} color="border-green-200 bg-green-50" />
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "pending", "approved", "paid", "cancelled"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading commissions…</p>}
      {error && <p className="text-sm text-red-600">Failed to load commissions.</p>}

      {!isLoading && !error && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["ID", "Booking", "Rate", "Amount", "Status", "Paid At"].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No commissions found.</td></tr>
              ) : (
                filtered.map((c) => <CommissionRow key={c.id} c={c} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
