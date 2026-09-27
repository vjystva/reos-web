"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ApprovalsResponseSchema,
  DiscountRequestPayloadSchema,
  HoldExtensionPayloadSchema,
  type Approval,
  type ApprovalStatus,
  type ApprovalType,
} from "@/types/api";

export interface ApprovalFilters {
  status?: ApprovalStatus;
  type?: ApprovalType;
}

export function approvalTypeLabel(type: string): string {
  const map: Record<string, string> = {
    discount_request: "Discount",
    hold_extension: "Hold extension",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

export function approvalStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };
  return map[status] ?? status;
}

/** Tones are the `StatusPill` vocabulary used across the dashboard. */
export function approvalStatusTone(
  status: string,
): "good" | "warn" | "bad" | "neutral" {
  switch (status) {
    case "approved":
      return "good";
    case "pending":
      return "warn";
    case "rejected":
      return "bad";
    default:
      return "neutral";
  }
}

/** `135` → `2h 15m`. Used for the requested hold extension. */
export function minutesLabel(minutes: number): string {
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Row summary, derived from the type-specific `payload`.
 *
 * `payload` is a loose record on the wire (zod cannot discriminate a union off a
 * sibling key), so each shape is narrowed here and a payload that does not match
 * its `type` degrades to a dash instead of throwing inside render.
 */
export function approvalSummary(approval: Approval): {
  subject: string;
  detail: string;
  reason: string | null;
} {
  if (approval.type === "discount_request") {
    const parsed = DiscountRequestPayloadSchema.safeParse(approval.payload);
    if (!parsed.success) return { subject: "—", detail: "—", reason: null };
    return {
      subject: `Booking ${parsed.data.bookingId.slice(0, 8)}`,
      detail: `${parsed.data.requestedDiscountPercent}% requested`,
      reason: parsed.data.reason ?? null,
    };
  }
  const parsed = HoldExtensionPayloadSchema.safeParse(approval.payload);
  if (!parsed.success) return { subject: "—", detail: "—", reason: null };
  return {
    subject: `Hold ${parsed.data.holdId.slice(0, 8)}`,
    detail: `+${minutesLabel(parsed.data.additionalMinutes)} requested`,
    reason: parsed.data.reason ?? null,
  };
}

/** Roles allowed to action the queue — mirrors the backend's `@Roles()`. */
export function canResolveApprovals(role: string | null | undefined): boolean {
  if (!role) return false;
  // "admin" is this app's demo alias for builder_admin (see nav-config.ts).
  return (
    role === "sales_manager" ||
    role === "builder_admin" ||
    role === "admin" ||
    role === "super_admin"
  );
}

async function fetchApprovals(filters: ApprovalFilters): Promise<Approval[]> {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.type) qs.set("type", filters.type);
  const res = await fetch(
    `/api/approvals${qs.toString() ? `?${qs.toString()}` : ""}`,
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`approvals_fetch_failed_${res.status}`);
  const parsed = ApprovalsResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("approvals_shape_mismatch");
  return parsed.data;
}

/**
 * The approvals queue. The backend decides WHAT is in it: a sales_agent only
 * ever receives the requests they raised, managers/admins receive the whole
 * tenant queue — so the same hook serves "my requests" and "the queue".
 */
export function useApprovals(filters: ApprovalFilters = {}) {
  return useQuery({
    queryKey: ["approvals", filters.status ?? "all", filters.type ?? "all"],
    queryFn: () => fetchApprovals(filters),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}
