"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bookingStatusLabel,
  bookingStatusTone,
  collectionIndicatorClass,
  collectionPercent,
  toAmount,
  REGISTERED_BOOKING_STATUSES,
} from "@/lib/bookingTone";
import { formatDate, inr } from "@/lib/utils";
import { BookingsResponseSchema, type Booking } from "@/types/api";

async function fetchBookings(status?: string): Promise<{ data: Booking[]; total: number }> {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  const res = await fetch(`/api/bookings${qs.toString() ? "?" + qs.toString() : ""}`);
  if (res.status === 401) { window.location.href = "/login"; throw new Error("unauthorized"); }
  if (!res.ok) throw new Error(`bookings_fetch_failed_${res.status}`);
  const json = await res.json();
  const parsed = BookingsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("bookings_shape_mismatch");
  return parsed.data;
}

/**
 * `BookingSchema` is `.passthrough()` — the list endpoint is only guaranteed to
 * carry `id` / `leadId` / `createdAt`, and richer deployments nest the buyer,
 * unit, project, owner and channel partner under a handful of different keys.
 * Every column resolves defensively through the candidates below and falls back
 * to "—" rather than assuming a shape that may not be there.
 */
interface BookingRow {
  id: string;
  number: string;
  status: string;
  buyer: string | null;
  unit: string | null;
  project: string | null;
  value: number | null;
  collected: number | null;
  bookedOn: string | null;
  owner: string | null;
  partner: string | null;
}

function name(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const n = o.name ?? o.fullName ?? o.displayName;
    if (typeof n === "string" && n.trim()) return n.trim();
    const first = typeof o.firstName === "string" ? o.firstName : "";
    const last = typeof o.lastName === "string" ? o.lastName : "";
    const joined = `${first} ${last}`.trim();
    if (joined) return joined;
  }
  return null;
}

function pick(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

function toRow(b: Booking): BookingRow {
  const raw = b as Record<string, unknown>;
  const unit = raw.unit as Record<string, unknown> | undefined;
  const project =
    (raw.project as Record<string, unknown> | undefined) ??
    (unit?.project as Record<string, unknown> | undefined);

  const value = toAmount(
    pick(raw, [
      "bookingAmount",
      "totalAmount",
      "agreementValue",
      "totalValue",
      "saleValue",
    ]) ?? (unit ? pick(unit, ["effectivePrice", "listPrice"]) : undefined),
  );

  const collected = toAmount(
    pick(raw, [
      "collectedAmount",
      "amountPaid",
      "amountCollected",
      "paidAmount",
      "totalPaid",
    ]) ??
      (raw.paymentSchedule
        ? pick(raw.paymentSchedule as Record<string, unknown>, [
            "amountPaid",
            "collectedAmount",
          ])
        : undefined),
  );

  return {
    id: b.id,
    number:
      (pick(raw, ["bookingNumber", "bookingRef", "booking_number"]) as string) ??
      b.id.slice(0, 8),
    status: (raw.status as string) ?? "draft",
    buyer:
      name(pick(raw, ["lead", "customer", "buyer", "primaryApplicant"])) ??
      name(pick(raw, ["customerName", "buyerName", "leadName"])),
    unit:
      (unit?.unitNumber as string | undefined) ??
      (pick(raw, ["unitNumber"]) as string | undefined) ??
      (raw.unitId as string | undefined)?.slice(0, 8) ??
      null,
    project:
      name(project) ?? (pick(raw, ["projectName"]) as string | undefined) ?? null,
    value,
    collected,
    bookedOn:
      (pick(raw, [
        "bookingDate",
        "bookedAt",
        "confirmedAt",
        "createdAt",
      ]) as string | undefined) ?? null,
    owner:
      name(pick(raw, ["owner", "assignedTo", "salesAgent", "agent"])) ??
      name(pick(raw, ["ownerName", "agentName"])),
    partner:
      name(pick(raw, ["dealer", "partner", "channelPartner", "broker"])) ??
      name(pick(raw, ["dealerName", "partnerName"])),
  };
}

const COLUMNS: { key: string; label: string; numeric?: boolean }[] = [
  { key: "number", label: "Booking" },
  { key: "buyer", label: "Buyer" },
  { key: "unit", label: "Unit" },
  { key: "project", label: "Project" },
  { key: "value", label: "Value", numeric: true },
  { key: "collection", label: "Collection" },
  { key: "bookedOn", label: "Booked on", numeric: true },
  { key: "owner", label: "Owner" },
  { key: "partner", label: "Partner" },
  { key: "status", label: "Stage" },
  { key: "actions", label: "" },
];

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = React.useState("");

  const query = useQuery({
    queryKey: ["bookings", statusFilter],
    queryFn: () => fetchBookings(statusFilter || undefined),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const bookings = React.useMemo(
    () => (query.data?.data ?? []).map(toRow),
    [query.data],
  );
  const total = query.data?.total ?? 0;

  /**
   * There is no `/bookings/summary` endpoint — the BFF only proxies the
   * paginated list — so the tiles aggregate the rows currently on screen.
   * When the page is a subset of `total` that caveat is surfaced under the
   * tiles rather than presented as a portfolio-wide figure.
   */
  const summary = React.useMemo(() => {
    const withValue = bookings.filter((b) => b.value != null);
    const withCollected = bookings.filter((b) => b.collected != null);
    const bookedValue = withValue.length
      ? withValue.reduce((s, b) => s + (b.value ?? 0), 0)
      : null;
    const collected = withCollected.length
      ? withCollected.reduce((s, b) => s + (b.collected ?? 0), 0)
      : null;
    const outstanding =
      bookedValue != null && collected != null
        ? Math.max(0, bookedValue - collected)
        : null;
    const registered = bookings.filter((b) =>
      REGISTERED_BOOKING_STATUSES.includes((b.status ?? "").toLowerCase()),
    ).length;
    const active = bookings.filter(
      (b) => (b.status ?? "").toLowerCase() === "confirmed",
    ).length;
    return { bookedValue, collected, outstanding, registered, active };
  }, [bookings]);

  const isPartial = !query.isLoading && bookings.length > 0 && bookings.length < total;
  const collectedPct = collectionPercent(summary.collected, summary.bookedValue);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Bookings & Registration"
        subtitle={
          query.isLoading
            ? undefined
            : `${total} booking${total !== 1 ? "s" : ""}${
                statusFilter ? ` · ${bookingStatusLabel(statusFilter)}` : ""
              }`
        }
        actions={
          <>
            <PollIndicator
              isFetching={query.isFetching}
              isError={query.isError}
              dataUpdatedAt={query.dataUpdatedAt}
              onRetry={() => void query.refetch()}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="w-40"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="registered">Registered</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard
          label="Booked value"
          value={summary.bookedValue != null ? inr(summary.bookedValue) : null}
          hint={`${bookings.length} booking${bookings.length !== 1 ? "s" : ""} on this page`}
          isLoading={query.isLoading}
          isError={query.isError}
        />
        <MetricCard
          label="Collected"
          value={summary.collected != null ? inr(summary.collected) : null}
          hint={collectedPct != null ? `${collectedPct}% of booked value` : undefined}
          isLoading={query.isLoading}
          isError={query.isError}
        />
        <MetricCard
          label="Outstanding"
          value={summary.outstanding != null ? inr(summary.outstanding) : null}
          hint={
            collectedPct != null ? `${100 - collectedPct}% still to collect` : undefined
          }
          isLoading={query.isLoading}
          isError={query.isError}
        />
        <MetricCard
          label="Registered"
          value={query.isLoading ? null : summary.registered}
          subLabels={[{ label: "confirmed", value: summary.active }]}
          isLoading={query.isLoading}
          isError={query.isError}
        />
      </div>

      {isPartial ? (
        <p className="text-[11px] text-muted-foreground">
          Tiles aggregate the{" "}
          <span className="font-mono tabular-nums text-foreground">
            {bookings.length}
          </span>{" "}
          booking{bookings.length !== 1 ? "s" : ""} loaded on this page of{" "}
          <span className="font-mono tabular-nums text-foreground">{total}</span>{" "}
          — the bookings API exposes no summary aggregate, so portfolio totals
          are necessarily partial.
        </p>
      ) : null}

      {query.isError ? (
        <ErrorBanner
          message={(query.error as Error).message}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map((c) => (
              <TableHead key={c.key} numeric={c.numeric}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {COLUMNS.map((c) => (
                  <TableCell key={c.key}>
                    <Skeleton className="h-3 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : query.isError ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={COLUMNS.length}
                className="py-6 text-center text-xs text-destructive"
              >
                Failed to load bookings.
              </TableCell>
            </TableRow>
          ) : bookings.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={COLUMNS.length}
                className="py-6 text-center text-xs text-muted-foreground"
              >
                No bookings found
                {statusFilter ? ` with status "${bookingStatusLabel(statusFilter)}"` : ""}.
              </TableCell>
            </TableRow>
          ) : (
            bookings.map((b) => {
              const pct = collectionPercent(b.collected, b.value);
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-mono font-medium text-foreground">
                    {b.number}
                  </TableCell>
                  <TableCell className="text-foreground">{b.buyer ?? "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums text-foreground">
                    {b.unit ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.project ?? "—"}
                  </TableCell>
                  <TableCell numeric className="text-foreground">
                    {b.value != null ? inr(b.value) : "—"}
                  </TableCell>
                  <TableCell className="min-w-[7.5rem]">
                    {pct != null ? (
                      <div className="flex items-center gap-2">
                        <Progress
                          value={pct}
                          aria-label={`Collection ${pct}%`}
                          className="w-16"
                          indicatorClassName={collectionIndicatorClass(pct)}
                        />
                        <span className="font-mono tabular-nums text-foreground">
                          {pct}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell numeric className="text-muted-foreground">
                    {formatDate(b.bookedOn)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.owner ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.partner ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={bookingStatusTone(b.status)}>
                      {bookingStatusLabel(b.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <Link
                        href={`/dashboard/bookings/${b.id}/payments`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Payments
                      </Link>
                      <Link
                        href={`/dashboard/bookings/${b.id}/site-visits`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Visits
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
