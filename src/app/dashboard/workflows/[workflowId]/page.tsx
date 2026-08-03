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
              <span>Trigger: {w.triggerEvent.replace(/_/g, " ")}</span>
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
