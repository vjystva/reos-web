"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useBookingDetail, formatBookingStatus, bookingStatusClass } from "@/hooks/useBookingDetail";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex py-3 border-b border-gray-100 last:border-0">
      <dt className="w-40 shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value ?? <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${bookingStatusClass(status)}`}>
      {formatBookingStatus(status)}
    </span>
  );
}

export default function BookingDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : undefined;
  const { data, isLoading, error } = useBookingDetail(id);

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-32" />
      </div>
    );
  }

  if (error) {
    const msg = (error as Error).message;
    return (
      <div className="p-6">
        <p className="text-red-600 text-sm">
          {msg === "booking_not_found" ? "Booking not found." : "Failed to load booking details."}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {data.bookingNumber ? `Booking ${data.bookingNumber}` : `Booking ${data.id.slice(0, 8)}`}
        </h1>
        <StatusBadge status={data.status} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 px-6">
        <dl>
          <DetailRow label="Booking ID" value={data.id} />
          <DetailRow label="Unit ID" value={data.unitId} />
          {data.leadId && <DetailRow label="Lead ID" value={data.leadId} />}
          {data.bookingAmount && (
            <DetailRow
              label="Booking Amount"
              value={`₹${Number(data.bookingAmount).toLocaleString("en-IN")}`}
            />
          )}
          {data.confirmedAt && (
            <DetailRow label="Confirmed At" value={new Date(data.confirmedAt).toLocaleString()} />
          )}
          {data.cancelledAt && (
            <DetailRow label="Cancelled At" value={new Date(data.cancelledAt).toLocaleString()} />
          )}
          {data.createdAt && (
            <DetailRow label="Created At" value={new Date(data.createdAt).toLocaleString()} />
          )}
          {data.notes && <DetailRow label="Notes" value={data.notes} />}
        </dl>
      </div>
    </div>
  );
}
