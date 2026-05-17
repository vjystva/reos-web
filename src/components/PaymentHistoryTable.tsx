"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatCurrency } from "@/lib/formatCurrency";
import type { Payment } from "@/types/api";

interface PaymentHistoryTableProps {
  payments: Payment[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onBounce: (paymentId: string) => void;
  bouncingId: string | null;
}

export function PaymentHistoryTable({
  payments,
  isLoading,
  isError,
  onRetry,
  onBounce,
  bouncingId,
}: PaymentHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner message="Could not load payment history." onRetry={onRetry} />
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <p className="text-sm text-slate-500">No payments recorded yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Date</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Amount</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Mode</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Ref #</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Receipt</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 text-slate-700">
                {new Date(p.createdAt).toLocaleDateString("en-IN")}
              </td>
              <td className="px-4 py-2 font-medium text-slate-900">
                {formatCurrency(p.amount)}
              </td>
              <td className="px-4 py-2 text-slate-600">{p.mode}</td>
              <td className="px-4 py-2 text-slate-600">
                {p.referenceNumber ?? "—"}
              </td>
              <td className="px-4 py-2 text-slate-600">
                {p.receiptNumber ?? "—"}
              </td>
              <td className="px-4 py-2">
                {p.status === "bounced" ? (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    Bounced
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Cleared
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                {p.status !== "bounced" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50"
                    disabled={bouncingId === p.id}
                    onClick={() => onBounce(p.id)}
                  >
                    {bouncingId === p.id ? "…" : "Bounce"}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
