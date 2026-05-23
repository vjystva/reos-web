"use client";

import { useQuery } from "@tanstack/react-query";
import { BookingDetailSchema, type BookingDetail } from "@/types/api";

export function formatBookingStatus(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    completed: "Completed",
  };
  return map[status] ?? status;
}

export function bookingStatusClass(status: string): string {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

async function fetchBookingDetail(id: string): Promise<BookingDetail> {
  const res = await fetch(`/api/bookings/${id}`);
  if (res.status === 404) throw new Error("booking_not_found");
  if (!res.ok) throw new Error(`booking_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = BookingDetailSchema.safeParse(json);
  if (!parsed.success) throw new Error("booking_shape_mismatch");
  return parsed.data;
}

export function useBookingDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: ["bookings", id],
    queryFn: () => fetchBookingDetail(id!),
    enabled: Boolean(id),
    staleTime: 25_000,
    retry: false,
  });
}
