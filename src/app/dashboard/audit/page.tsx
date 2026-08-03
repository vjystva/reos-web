"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";

interface AuditLog {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

async function fetchAuditLogs(params?: { cursor?: string; entityType?: string }): Promise<{ data: AuditLog[]; hasMore: boolean }> {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set("cursor", params.cursor);
  if (params?.entityType) qs.set("entityType", params.entityType);
  qs.set("limit", "50");
  const res = await fetch(`/api/audit-logs?${qs.toString()}`);
  if (res.status === 401) { window.location.href = "/login"; throw new Error("unauthorized"); }
  if (!res.ok) throw new Error(`audit_fetch_failed_${res.status}`);
  const json = await res.json() as { data?: AuditLog[]; hasMore?: boolean };
  return { data: json.data ?? [], hasMore: json.hasMore ?? false };
}

function actionColor(action: string) {
  if (action.includes("create") || action.includes("CREATE")) return "bg-green-100 text-green-800";
  if (action.includes("delete") || action.includes("DELETE")) return "bg-red-100 text-red-800";
  if (action.includes("update") || action.includes("UPDATE") || action.includes("patch") || action.includes("PATCH")) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default function AuditPage() {
  const [entityFilter, setEntityFilter] = React.useState("");
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);

  const query = useQuery({
    queryKey: ["audit-logs", entityFilter, cursor],
    queryFn: () => fetchAuditLogs({ cursor, entityType: entityFilter || undefined }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const logs = query.data?.data ?? [];
  const hasMore = query.data?.hasMore ?? false;

  const lastLog = logs[logs.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500">Complete action history for compliance and security</p>
        </div>
        <div className="flex items-center gap-2">
          <PollIndicator isFetching={query.isFetching} isError={query.isError} dataUpdatedAt={query.dataUpdatedAt} onRetry={() => void query.refetch()} />
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setCursor(undefined); }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            <option value="">All entity types</option>
            <option value="lead">Lead</option>
            <option value="booking">Booking</option>
            <option value="user">User</option>
            <option value="dealer">Dealer</option>
            <option value="payment">Payment</option>
            <option value="unit">Unit</option>
          </select>
        </div>
      </div>

      {query.isError && <ErrorBanner message={(query.error as Error).message} onRetry={() => void query.refetch()} />}

      {query.isLoading && (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      )}

      {!query.isLoading && logs.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">No audit logs found{entityFilter ? ` for entity type "${entityFilter}"` : ""}.</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Entity ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 capitalize">{log.entityType ?? "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">{log.entityId?.slice(0, 12) ?? "—"}…</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">{log.userId?.slice(0, 8) ?? "—"}…</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString("en-IN") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && lastLog?.createdAt && (
        <div className="text-center">
          <button
            onClick={() => setCursor(lastLog.createdAt)}
            className="text-sm text-blue-600 hover:underline"
          >
            Load older logs
          </button>
        </div>
      )}
    </div>
  );
}
