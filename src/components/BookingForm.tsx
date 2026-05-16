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
import { formatCurrency } from "@/lib/formatCurrency";
import { stageLabel } from "@/lib/utils";
import type { Lead, BookingCreated } from "@/types/api";

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
    <form onSubmit={submit} className="space-y-4">
      <fieldset className="space-y-2">
        <label
          htmlFor="lead-search"
          className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
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
          className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              {leads.length === 0
                ? "No leads assigned to you. Create a lead first."
                : "No matching leads."}
            </div>
          ) : (
            <ul>
              {filtered.map((lead) => {
                const active = lead.id === selectedLeadId;
                return (
                  <li key={lead.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                        active ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">{lead.name}</span>
                        <span
                          className={
                            active ? "text-xs text-slate-300" : "text-xs text-slate-500"
                          }
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
        <label
          htmlFor="booking-amount"
          className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Booking amount
        </label>
        <Input
          id="booking-amount"
          type="number"
          min={0}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          Default: {formatCurrency(defaultAmount)}
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
          <span className="ml-auto self-center text-xs text-slate-500">
            for {selectedLead.name}
          </span>
        ) : null}
      </div>
    </form>
  );
}
