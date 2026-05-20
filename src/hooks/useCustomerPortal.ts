"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CustomerBookingsResponseSchema,
  CustomerBookingSummarySchema,
  PaymentScheduleViewSchema,
  CustomerDocumentsResponseSchema,
  CustomerSiteVisitsResponseSchema,
  type CustomerBookingsResponse,
  type CustomerBookingSummary,
  type PaymentScheduleView,
  type CustomerDocumentsResponse,
  type CustomerSiteVisitsResponse,
} from "@/types/api";

const STALE_TIME = 25_000;
const REFETCH_INTERVAL = 30_000;

// ---------------------------------------------------------------------------
// useCustomerBookings — list my bookings
// ---------------------------------------------------------------------------

async function fetchCustomerBookings(): Promise<CustomerBookingsResponse> {
  const res = await fetch("/api/customer-portal/bookings");
  if (!res.ok) throw new Error(`customer_bookings_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = CustomerBookingsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("customer_bookings_shape_mismatch");
  return parsed.data;
}

export function useCustomerBookings() {
  return useQuery({
    queryKey: ["customer-portal", "bookings"],
    queryFn: fetchCustomerBookings,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// ---------------------------------------------------------------------------
// useCustomerBooking — single booking detail
// ---------------------------------------------------------------------------

async function fetchCustomerBooking(id: string): Promise<CustomerBookingSummary> {
  const res = await fetch(`/api/customer-portal/bookings/${id}`);
  if (!res.ok) throw new Error(`customer_booking_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = CustomerBookingSummarySchema.safeParse(json);
  if (!parsed.success) throw new Error("customer_booking_shape_mismatch");
  return parsed.data;
}

export function useCustomerBooking(id: string) {
  return useQuery({
    queryKey: ["customer-portal", "bookings", id],
    queryFn: () => fetchCustomerBooking(id),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// useCustomerPayments — payment milestones for a booking
// ---------------------------------------------------------------------------

async function fetchCustomerPayments(bookingId: string): Promise<PaymentScheduleView> {
  const res = await fetch(`/api/customer-portal/payments/${bookingId}`);
  if (!res.ok) throw new Error(`customer_payments_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = PaymentScheduleViewSchema.safeParse(json);
  if (!parsed.success) throw new Error("customer_payments_shape_mismatch");
  return parsed.data;
}

export function useCustomerPayments(bookingId: string) {
  return useQuery({
    queryKey: ["customer-portal", "payments", bookingId],
    queryFn: () => fetchCustomerPayments(bookingId),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    enabled: Boolean(bookingId),
  });
}

// ---------------------------------------------------------------------------
// useCustomerDocuments — documents for a booking
// ---------------------------------------------------------------------------

async function fetchCustomerDocuments(bookingId: string): Promise<CustomerDocumentsResponse> {
  const res = await fetch(`/api/customer-portal/documents/${bookingId}`);
  if (!res.ok) throw new Error(`customer_documents_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = CustomerDocumentsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("customer_documents_shape_mismatch");
  return parsed.data;
}

export function useCustomerDocuments(bookingId: string) {
  return useQuery({
    queryKey: ["customer-portal", "documents", bookingId],
    queryFn: () => fetchCustomerDocuments(bookingId),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    enabled: Boolean(bookingId),
  });
}

// ---------------------------------------------------------------------------
// useCustomerSiteVisits — site visits for a booking
// ---------------------------------------------------------------------------

async function fetchCustomerSiteVisits(bookingId: string): Promise<CustomerSiteVisitsResponse> {
  const res = await fetch(`/api/customer-portal/site-visits/${bookingId}`);
  if (!res.ok) throw new Error(`customer_site_visits_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = CustomerSiteVisitsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("customer_site_visits_shape_mismatch");
  return parsed.data;
}

export function useCustomerSiteVisits(bookingId: string) {
  return useQuery({
    queryKey: ["customer-portal", "site-visits", bookingId],
    queryFn: () => fetchCustomerSiteVisits(bookingId),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    enabled: Boolean(bookingId),
  });
}
