"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadsForBooking } from "@/hooks/useLeadsForBooking";
import {
  useBookingMutation,
  BookingConflictError,
} from "@/hooks/useBookingMutation";
import { cn, inr, stageLabel } from "@/lib/utils";
import type { Lead, BookingCreated } from "@/types/api";

/** Dense field label recipe — shared across the booking surfaces. */
const LABEL = "block text-[11px] uppercase tracking-wider text-muted-foreground";

interface BookingFormProps {
  unitId: string;
  unitNumber: string;
  defaultAmount: number;
  onCancel: () => void;
  onSuccess: (booking: BookingCreated) => void;
}

export function BookingForm({
  unitId,
  unitNumber,
  defaultAmount,
  onCancel,
  onSuccess,
}: BookingFormProps) {
  const leadsQ = useLeadsForBooking();
  const mutation = useBookingMutation();

  const [search, setSearch] = React.useState("");
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(
    null,
  );
  const [amount, setAmount] = React.useState<string>(
    Number.isFinite(defaultAmount) ? String(defaultAmount) : "",
  );

  const leads: Lead[] = React.useMemo(
    () => leadsQ.data?.data ?? [],
    [leadsQ.data],
  );
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const name = (l.name ?? "").toLowerCase();
      const phone = (l.phone ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [leads, search]);

  const selectedLead = React.useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLeadId) return;
    const numericAmount = Number(amount);
    mutation.mutate(
      {
        leadId: selectedLeadId,
        unitId,
        bookingAmount: Number.isFinite(numericAmount) ? numericAmount : undefined,
      },
      {
        onSuccess,
      },
    );
  }

  const errorMessage = React.useMemo(() => {
    if (!mutation.error) return null;
    const err = mutation.error;
    if (err instanceof BookingConflictError) {
      if (err.status === 409) {
        return "This unit was just booked by another agent. The grid has been refreshed.";
      }
      return err.message || `Booking failed (${err.status}).`;
    }
    return err.message || "Booking failed. Try again.";
  }, [mutation.error]);

  if (leadsQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (leadsQ.isError) {
    return (
      <ErrorBanner
        message="Failed to load leads."
        onRetry={() => leadsQ.refetch()}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <fieldset className="space-y-1.5">
        <label htmlFor="lead-search" className={LABEL}>
          Select lead
        </label>
        <Input
          id="lead-search"
          placeholder="Search by name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        <div
          role="listbox"
          aria-label="Leads"
          className="max-h-48 overflow-y-auto rounded-md border border-border bg-card"
        >
          {filtered.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-muted-foreground">
              {leads.length === 0
                ? "No leads assigned to you. Create a lead first."
                : "No matching leads."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((lead) => {
                const active = lead.id === selectedLeadId;
                return (
                  <li key={lead.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-2.5 py-2 text-left text-xs transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted/60",
                      )}
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{lead.name}</span>
                        <span
                          className={cn(
                            "text-[11px]",
                            active
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {lead.phone ?? "no phone"} · {stageLabel(lead.stage)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <label htmlFor="booking-amount" className={LABEL}>
          Booking amount
        </label>
        <Input
          id="booking-amount"
          type="number"
          min={0}
          step={1}
          className="font-mono tabular-nums"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Default:{" "}
          <span className="font-mono tabular-nums text-foreground">
            {inr(defaultAmount)}
          </span>
        </p>
      </fieldset>

      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!selectedLeadId || mutation.isPending}
          aria-label={`Confirm booking for unit ${unitNumber}`}
        >
          {mutation.isPending ? "Confirming…" : "Confirm booking"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
        {selectedLead ? (
          <span className="ml-auto self-center text-[11px] text-muted-foreground">
            for {selectedLead.name}
          </span>
        ) : null}
      </div>
    </form>
  );
}
