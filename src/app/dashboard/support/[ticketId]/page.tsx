"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { TicketPriorityBadge } from "@/components/TicketPriorityBadge";
import { TicketReplyThread } from "@/components/TicketReplyThread";
import { useSupportTicket } from "@/hooks/useSupportTicket";
import { useAddReplyMutation } from "@/hooks/useAddReplyMutation";
import { useUpdateTicketStatusMutation } from "@/hooks/useUpdateTicketStatusMutation";
import {
  TICKET_STATUSES,
  type CreateReplyRequest,
  type TicketStatus,
} from "@/types/api";

export default function SupportTicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = params?.ticketId ?? null;

  const ticketQuery = useSupportTicket(ticketId);
  const addReplyMutation = useAddReplyMutation();
  const updateStatusMutation = useUpdateTicketStatusMutation();

  const [replyError, setReplyError] = React.useState<string | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);

  const ticket = ticketQuery.data;

  async function handleAddReply(body: CreateReplyRequest) {
    if (!ticketId) return;
    setReplyError(null);
    try {
      await addReplyMutation.mutateAsync({ ticketId, body });
    } catch (err) {
      setReplyError(
        err instanceof Error ? err.message : "Failed to add reply",
      );
    }
  }

  async function handleStatusChange(next: TicketStatus) {
    if (!ticketId) return;
    setStatusError(null);
    try {
      await updateStatusMutation.mutateAsync({ ticketId, status: next });
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Failed to update status",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link
          href="/dashboard/support"
          className="inline-flex items-center gap-1 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to tickets
        </Link>
      </div>

      {ticketQuery.isError ? (
        <ErrorBanner
          message="Failed to load ticket."
          onRetry={() => ticketQuery.refetch()}
        />
      ) : ticketQuery.isLoading || !ticket ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Loading ticket…
        </div>
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-4">
            <div className="min-w-0 space-y-2">
              <h1 className="text-lg font-semibold text-slate-900">
                {ticket.subject}
              </h1>
              <div className="flex items-center gap-2">
                <TicketStatusBadge status={ticket.status} />
                <TicketPriorityBadge priority={ticket.priority} />
                <span className="text-xs text-slate-500">
                  Created {new Date(ticket.createdAt).toLocaleString()}
                </span>
              </div>
              {ticket.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {ticket.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <PollIndicator
                isFetching={ticketQuery.isFetching}
                isError={ticketQuery.isError}
                dataUpdatedAt={ticketQuery.dataUpdatedAt}
                onRetry={() => ticketQuery.refetch()}
              />
              <div className="flex items-center gap-2">
                <label
                  htmlFor="ticket-status-change"
                  className="text-xs text-slate-700"
                >
                  Status:
                </label>
                <Select
                  id="ticket-status-change"
                  value={ticket.status}
                  disabled={updateStatusMutation.isPending}
                  onChange={(e) =>
                    void handleStatusChange(e.target.value as TicketStatus)
                  }
                  className="w-auto"
                >
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
              {statusError && (
                <p className="text-xs text-red-600">{statusError}</p>
              )}
            </div>
          </header>

          <section className="rounded-md border border-slate-200 bg-white p-4">
            <TicketReplyThread
              replies={ticket.replies ?? []}
              isSubmitting={addReplyMutation.isPending}
              error={replyError}
              onSubmit={(data) => void handleAddReply(data)}
            />
          </section>
        </>
      )}
    </div>
  );
}
