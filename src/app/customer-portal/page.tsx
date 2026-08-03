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
      <div className="p-8 text-center text-muted-foreground">
        Loading your bookings…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="m-8 rounded-lg bg-destructive/10 p-8 text-center text-destructive">
        Failed to load bookings.{" "}
        {error instanceof Error ? error.message : "Unknown error."}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">My Bookings</h1>
      <p className="mb-7 mt-1 text-sm text-muted-foreground">
        Track your property purchases and payment progress.
      </p>

      {!bookings || bookings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-12 text-center text-muted-foreground">
          No bookings found.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {bookings.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}
