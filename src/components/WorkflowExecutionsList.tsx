"use client";

import * as React from "react";
import { WorkflowExecutionStatusBadge } from "@/components/WorkflowStatusBadge";
import type { WorkflowExecution } from "@/types/api";

interface WorkflowExecutionsListProps {
  executions: WorkflowExecution[];
  isLoading?: boolean;
  isError?: boolean;
  workflowId?: string;
}

function fmt(dt: string | null | undefined): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export function WorkflowExecutionsList({
  executions,
  isLoading,
  isError,
  workflowId,
}: WorkflowExecutionsListProps) {
  const rows = workflowId
    ? executions.filter((e) => e.workflowId === workflowId)
    : executions;

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load executions.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Loading executions…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No executions yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Started</th>
            <th className="px-3 py-2">Finished</th>
            <th className="px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr
              key={e.id}
              className="border-t border-slate-100 align-top"
            >
              <td className="px-3 py-2">
                <WorkflowExecutionStatusBadge status={e.status} />
              </td>
              <td className="px-3 py-2 text-slate-700">{fmt(e.startedAt)}</td>
              <td className="px-3 py-2 text-slate-700">{fmt(e.finishedAt)}</td>
              <td className="px-3 py-2 text-slate-500">
                {e.error ? (
                  <span className="text-red-700">{e.error}</span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
