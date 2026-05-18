"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BookingsByProjectResponseSchema,
  type BookingsByProjectResponse,
} from "@/types/api";

async function fetchBookingsByProject(): Promise<BookingsByProjectResponse> {
  const res = await fetch("/api/analytics/bookings-by-project");
  if (!res.ok) throw new Error(`bookings_by_project_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = BookingsByProjectResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("bookings_by_project_shape_mismatch");
  return parsed.data;
}

export function useBookingsByProject() {
  return useQuery({
    queryKey: ["analytics", "bookings-by-project"],
    queryFn: fetchBookingsByProject,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
