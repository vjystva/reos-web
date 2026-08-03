"use client";

import * as React from "react";
import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { WorkflowStatusBadge } from "@/components/WorkflowStatusBadge";
import { CreateWorkflowForm } from "@/components/CreateWorkflowForm";
import { useWorkflows } from "@/hooks/useWorkflows";
import { useCreateWorkflowMutation } from "@/hooks/useCreateWorkflowMutation";
import { useUpdateWorkflowMutation } from "@/hooks/useUpdateWorkflowMutation";
import { useTriggerWorkflowMutation } from "@/hooks/useTriggerWorkflowMutation";
import { Button } from "@/components/ui/button";
import type { CreateWorkflowRequest } from "@/types/api";

export default function WorkflowsPage() {
  const workflowsQuery = useWorkflows();
  const createMutation = useCreateWorkflowMutation();
  const updateMutation = useUpdateWorkflowMutation();
  const triggerMutation = useTriggerWorkflowMutation();

  const [createError, setCreateError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actingId, setActingId] = React.useState<string | null>(null);

  const workflows = workflowsQuery.data?.data ?? [];

  async function handleCreate(data: CreateWorkflowRequest) {
    setCreateError(null);
    try {
      await createMutation.mutateAsync(data);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create workflow",
      );
    }
  }

  async function handleToggle(workflowId: string, nextActive: boolean) {
    setActionError(null);
    setActingId(workflowId);
    try {
      await updateMutation.mutateAsync({
        workflowId,
        body: { isActive: nextActive },
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update workflow",
      );
    } finally {
      setActingId(null);
    }
  }

  async function handleTrigger(workflowId: string) {
    setActionError(null);
    setActingId(workflowId);
    try {
      await triggerMutation.mutateAsync(workflowId);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to trigger workflow",
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Workflows</h1>
          <p className="text-sm text-slate-500">
            Automate notifications, tasks, and stage changes based on triggers.
          </p>
        </div>
        <PollIndicator
          isFetching={workflowsQuery.isFetching}
          isError={workflowsQuery.isError}
          dataUpdatedAt={workflowsQuery.dataUpdatedAt}
          onRetry={() => workflowsQuery.refetch()}
        />
      </header>

      {actionError && <ErrorBanner message={actionError} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          {workflowsQuery.isError ? (
            <ErrorBanner
              message="Failed to load workflows."
              onRetry={() => workflowsQuery.refetch()}
            />
          ) : workflowsQuery.isLoading ? (
            <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Loading workflows…
            </div>
          ) : workflows.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              No workflows configured. Use the form on the right to create one.
            </div>
          ) : (
            <ul role="list" className="space-y-2">
              {workflows.map((w) => {
                const isActing = actingId === w.id;
                return (
                  <li
                    key={w.id}
                    className="rounded-md border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/workflows/${w.id}`}
                          className="block truncate font-medium text-slate-900 hover:underline"
                        >
                          {w.name}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          Trigger: {w.triggerEvent.replace(/_/g, " ")}
                        </p>
                      </div>
                      <WorkflowStatusBadge isActive={w.isActive} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isActing}
                        onClick={() => void handleToggle(w.id, !w.isActive)}
                      >
                        {w.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isActing || !w.isActive}
                        onClick={() => void handleTrigger(w.id)}
                      >
                        Trigger
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            New workflow
          </h2>
          <CreateWorkflowForm
            isSubmitting={createMutation.isPending}
            error={createError}
            onSubmit={(data) => void handleCreate(data)}
          />
        </section>
      </div>
    </div>
  );
}
