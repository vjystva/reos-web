"use client";

import * as React from "react";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { TicketPriorityBadge } from "@/components/TicketPriorityBadge";
import { CreateTicketForm } from "@/components/CreateTicketForm";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { useCreateTicketMutation } from "@/hooks/useCreateTicketMutation";
import {
  TICKET_STATUSES,
  type CreateTicketRequest,
  type TicketStatus,
} from "@/types/api";

export default function SupportPage() {
  const [statusFilter, setStatusFilter] = React.useState<TicketStatus | "">("");
  const [createError, setCreateError] = React.useState<string | null>(null);

  const ticketsQuery = useSupportTickets({
    status: statusFilter || undefined,
  });
  const createMutation = useCreateTicketMutation();

  const tickets = ticketsQuery.data?.data ?? [];

  async function handleCreate(data: CreateTicketRequest) {
    setCreateError(null);
    try {
      await createMutation.mutateAsync(data);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create ticket",
      );
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Support</h1>
          <p className="text-sm text-slate-500">
            Track customer and internal support tickets.
          </p>
        </div>
        <PollIndicator
          isFetching={ticketsQuery.isFetching}
          isError={ticketsQuery.isError}
          dataUpdatedAt={ticketsQuery.dataUpdatedAt}
          onRetry={() => ticketsQuery.refetch()}
        />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="ticket-status-filter"
              className="text-sm text-slate-700"
            >
              Status:
            </label>
            <Select
              id="ticket-status-filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as TicketStatus | "")
              }
              className="w-auto"
            >
              <option value="">All</option>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>

          {ticketsQuery.isError ? (
            <ErrorBanner
              message="Failed to load tickets."
              onRetry={() => ticketsQuery.refetch()}
            />
          ) : ticketsQuery.isLoading ? (
            <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Loading tickets…
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              No tickets to show.
            </div>
          ) : (
            <ul role="list" className="space-y-2">
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="rounded-md border border-slate-200 bg-white"
                >
                  <Link
                    href={`/dashboard/support/${t.id}`}
                    className="block p-3 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {t.subject}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(t.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <TicketStatusBadge status={t.status} />
                        <TicketPriorityBadge priority={t.priority} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            New ticket
          </h2>
          <CreateTicketForm
            isSubmitting={createMutation.isPending}
            error={createError}
            onSubmit={(data) => void handleCreate(data)}
          />
        </section>
      </div>
    </div>
  );
}
