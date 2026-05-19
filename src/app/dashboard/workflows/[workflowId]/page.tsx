"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { WorkflowStatusBadge } from "@/components/WorkflowStatusBadge";
import { WorkflowExecutionsList } from "@/components/WorkflowExecutionsList";
import { useWorkflow } from "@/hooks/useWorkflow";
import { useWorkflowExecutions } from "@/hooks/useWorkflowExecutions";

export default function WorkflowDetailPage() {
  const params = useParams<{ workflowId: string }>();
  const workflowId = params?.workflowId ?? null;

  const workflowQuery = useWorkflow(workflowId);
  const executionsQuery = useWorkflowExecutions({
    workflowId: workflowId ?? undefined,
  });

  const w = workflowQuery.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/dashboard/workflows"
            className="text-xs text-slate-500 hover:underline"
          >
            ← All workflows
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">
            {w?.name ?? "Workflow"}
          </h1>
          {w && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <WorkflowStatusBadge isActive={w.isActive} />
              <span>Trigger: {w.triggerType.replace(/_/g, " ")}</span>
              <span>·</span>
              <span>
                {w.actions.length} action{w.actions.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
        <PollIndicator
          isFetching={executionsQuery.isFetching}
          isError={executionsQuery.isError}
          dataUpdatedAt={executionsQuery.dataUpdatedAt}
          onRetry={() => executionsQuery.refetch()}
        />
      </header>

      {workflowQuery.isError && (
        <ErrorBanner
          message="Failed to load workflow."
          onRetry={() => workflowQuery.refetch()}
        />
      )}

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Actions</h2>
        {workflowQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !w ? (
          <p className="text-sm text-slate-500">Workflow not available.</p>
        ) : w.actions.length === 0 ? (
          <p className="text-sm text-slate-500">No actions defined.</p>
        ) : (
          <ol className="space-y-2">
            {w.actions.map((a, idx) => (
              <li
                key={idx}
                className="rounded-md border border-slate-100 bg-slate-50 p-3"
              >
                <p className="text-sm font-medium text-slate-800">
                  {idx + 1}. {a.actionType.replace(/_/g, " ")}
                </p>
                {a.config && Object.keys(a.config).length > 0 && (
                  <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
                    {Object.entries(a.config).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="font-medium">{k}:</dt>
                        <dd className="truncate">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Recent executions
        </h2>
        <WorkflowExecutionsList
          executions={executionsQuery.data?.data ?? []}
          isLoading={executionsQuery.isLoading}
          isError={executionsQuery.isError}
          workflowId={workflowId ?? undefined}
        />
      </section>
    </div>
  );
}
