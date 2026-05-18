"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { useCommunicationLogs } from "@/hooks/useCommunicationLogs";
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_LOG_STATUSES,
  type CommunicationChannel,
  type CommunicationLog,
  type CommunicationLogStatus,
} from "@/types/api";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function StatusBadge({ status }: { status: CommunicationLogStatus }) {
  const styles: Record<CommunicationLogStatus, string> = {
    queued: "bg-slate-100 text-slate-700",
    sent: "bg-blue-100 text-blue-800",
    delivered: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function CommunicationLogsList() {
  const [statusFilter, setStatusFilter] = React.useState<
    CommunicationLogStatus | ""
  >("");
  const [channelFilter, setChannelFilter] = React.useState<
    CommunicationChannel | ""
  >("");

  const logsQuery = useCommunicationLogs({
    status: statusFilter || undefined,
    channel: channelFilter || undefined,
  });

  const logs: CommunicationLog[] = logsQuery.data?.data ?? [];

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Delivery logs
          </h2>
          <p className="text-xs text-slate-500">
            Latest outbound messages and their delivery status.
          </p>
        </div>
        <PollIndicator
          isFetching={logsQuery.isFetching}
          isError={logsQuery.isError}
          dataUpdatedAt={logsQuery.dataUpdatedAt}
          onRetry={() => logsQuery.refetch()}
        />
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            className="block text-xs font-medium text-slate-700"
            htmlFor="logs-filter-status"
          >
            Status
          </label>
          <Select
            id="logs-filter-status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as CommunicationLogStatus | "")
            }
            className="w-36"
          >
            <option value="">All</option>
            {COMMUNICATION_LOG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label
            className="block text-xs font-medium text-slate-700"
            htmlFor="logs-filter-channel"
          >
            Channel
          </label>
          <Select
            id="logs-filter-channel"
            value={channelFilter}
            onChange={(e) =>
              setChannelFilter(e.target.value as CommunicationChannel | "")
            }
            className="w-36"
          >
            <option value="">All</option>
            {COMMUNICATION_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {logsQuery.isError ? (
        <ErrorBanner
          message="Failed to load delivery logs."
          onRetry={() => logsQuery.refetch()}
        />
      ) : logsQuery.isLoading ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Loading…
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
          No messages match these filters yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold text-slate-700"
                >
                  Channel
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold text-slate-700"
                >
                  Recipient
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold text-slate-700"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold text-slate-700"
                >
                  Sent at
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-3 py-2 text-slate-700">{log.channel}</td>
                  <td className="px-3 py-2 text-slate-900">
                    {log.recipient}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {formatTimestamp(log.sentAt ?? log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
