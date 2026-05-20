"use client";

import { useCustomerBookings } from "@/hooks/useCustomerPortal";
import Link from "next/link";
import type { CustomerBookingSummary } from "@/types/api";

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    completed: "Completed",
  };
  return labels[status] ?? status;
}

function statusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "#6b7280",
    confirmed: "#16a34a",
    cancelled: "#dc2626",
    completed: "#2563eb",
  };
  return colors[status] ?? "#6b7280";
}

function BookingCard({ booking }: { booking: CustomerBookingSummary }) {
  const pct =
    booking.totalAmount && Number(booking.totalAmount) > 0
      ? Math.min(
          100,
          Math.round(
            (Number(booking.collectedAmount) / Number(booking.totalAmount)) *
              100,
          ),
        )
      : 0;

  return (
    <Link
      href={`/customer-portal/${booking.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "20px 24px",
          background: "#fff",
          cursor: "pointer",
          transition: "box-shadow 0.15s",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
              {booking.bookingRef}
            </div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Unit: {booking.unitId}
            </div>
          </div>
          <span
            style={{
              background: statusColor(booking.status) + "1a",
              color: statusColor(booking.status),
              border: `1px solid ${statusColor(booking.status)}33`,
              borderRadius: 12,
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {statusLabel(booking.status)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 24,
            fontSize: 14,
            marginBottom: 12,
          }}
        >
          <div>
            <span style={{ color: "#9ca3af" }}>Total</span>
            <div style={{ fontWeight: 600 }}>
              {booking.totalAmount != null
                ? `₹${Number(booking.totalAmount).toLocaleString("en-IN")}`
                : "—"}
            </div>
          </div>
          <div>
            <span style={{ color: "#9ca3af" }}>Collected</span>
            <div style={{ fontWeight: 600 }}>
              ₹{Number(booking.collectedAmount).toLocaleString("en-IN")}
            </div>
          </div>
          <div>
            <span style={{ color: "#9ca3af" }}>Paid</span>
            <div style={{ fontWeight: 600 }}>{pct}%</div>
          </div>
        </div>

        {booking.totalAmount != null && (
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: "#e5e7eb",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: "#2563eb",
                borderRadius: 3,
                transition: "width 0.3s",
              }}
            />
          </div>
        )}

        <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 10 }}>
          Booked on{" "}
          {new Date(booking.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
      </div>
    </Link>
  );
}

export default function CustomerPortalPage() {
  const { data: bookings, isLoading, isError, error } = useCustomerBookings();

  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>
        Loading your bookings…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "#dc2626",
          background: "#fef2f2",
          borderRadius: 8,
          margin: 32,
        }}
      >
        Failed to load bookings.{" "}
        {error instanceof Error ? error.message : "Unknown error."}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        My Bookings
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 28, fontSize: 14 }}>
        Track your property purchases and payment progress.
      </p>

      {!bookings || bookings.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 48,
            color: "#9ca3af",
            background: "#f9fafb",
            borderRadius: 8,
            border: "1px dashed #e5e7eb",
          }}
        >
          No bookings found.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {bookings.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}
