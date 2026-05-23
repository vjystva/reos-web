"use client";

import { useCustomerBookings } from "@/hooks/useCustomerPortal";
import Link from "next/link";
import type { CustomerBookingSummary } from "@/types/api";

function formatInr(value: string | number | null): string {
  if (value == null) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return `₹${num.toLocaleString("en-IN")}`;
}

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
  const extra = booking as CustomerBookingSummary & {
    unitNumber?: string;
    projectName?: string;
  };

  return (
    <Link
      href={`/customer/bookings/${booking.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
      data-testid="booking-card-link"
    >
      <article
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "20px 24px",
          background: "#fff",
          cursor: "pointer",
        }}
        aria-label={`Booking ${booking.bookingRef}`}
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
            <div
              style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}
              data-testid="booking-ref"
            >
              {booking.bookingRef}
            </div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              {extra.unitNumber
                ? `Unit: ${extra.unitNumber}`
                : `Unit ID: ${booking.unitId}`}
            </div>
            {extra.projectName && (
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                {extra.projectName}
              </div>
            )}
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
            data-testid="status-badge"
          >
            {statusLabel(booking.status)}
          </span>
        </div>

        <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
          <div>
            <div style={{ color: "#9ca3af", fontSize: 12 }}>Total</div>
            <div style={{ fontWeight: 600 }} data-testid="total-amount">
              {formatInr(booking.totalAmount)}
            </div>
          </div>
          <div>
            <div style={{ color: "#9ca3af", fontSize: 12 }}>Collected</div>
            <div style={{ fontWeight: 600 }} data-testid="collected-amount">
              {formatInr(booking.collectedAmount)}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "20px 24px",
        background: "#fff",
      }}
      aria-hidden="true"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              height: 20,
              width: 120,
              background: "#e5e7eb",
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              height: 14,
              width: 80,
              background: "#f3f4f6",
              borderRadius: 4,
            }}
          />
        </div>
        <div
          style={{
            height: 24,
            width: 72,
            background: "#e5e7eb",
            borderRadius: 12,
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <div
          style={{
            height: 36,
            width: 80,
            background: "#f3f4f6",
            borderRadius: 4,
          }}
        />
        <div
          style={{
            height: 36,
            width: 80,
            background: "#f3f4f6",
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
}

export default function CustomerBookingsPage() {
  const { data: bookings, isLoading, isError, error } = useCustomerBookings();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        My Bookings
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 28, fontSize: 14 }}>
        View and track all your property bookings.
      </p>

      {isLoading && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
          aria-label="Loading bookings"
          data-testid="loading-skeleton"
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {isError && (
        <div
          style={{
            padding: 24,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#dc2626",
          }}
          role="alert"
          data-testid="error-state"
        >
          Failed to load bookings.{" "}
          {error instanceof Error ? error.message : "Please try again."}
        </div>
      )}

      {!isLoading && !isError && (!bookings || bookings.length === 0) && (
        <div
          style={{
            textAlign: "center",
            padding: 48,
            color: "#9ca3af",
            background: "#f9fafb",
            borderRadius: 8,
            border: "1px dashed #e5e7eb",
          }}
          data-testid="empty-state"
        >
          No bookings found.
        </div>
      )}

      {!isLoading && !isError && bookings && bookings.length > 0 && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
          data-testid="bookings-list"
        >
          {bookings.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}
