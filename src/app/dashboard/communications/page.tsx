"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { TemplateForm } from "@/components/TemplateForm";
import { CommunicationLogsList } from "@/components/CommunicationLogsList";
import { useCommunicationTemplates } from "@/hooks/useCommunicationTemplates";
import { useCreateTemplateMutation } from "@/hooks/useCreateTemplateMutation";
import { useUpdateTemplateMutation } from "@/hooks/useUpdateTemplateMutation";
import { useDeleteTemplateMutation } from "@/hooks/useDeleteTemplateMutation";
import { useSendCommunicationMutation } from "@/hooks/useSendCommunicationMutation";
import type {
  CommunicationTemplate,
  CreateTemplateRequest,
} from "@/types/api";

type FormMode =
  | { kind: "hidden" }
  | { kind: "create" }
  | { kind: "edit"; template: CommunicationTemplate };

export default function CommunicationsPage() {
  const [formMode, setFormMode] = React.useState<FormMode>({ kind: "hidden" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const [sendStatus, setSendStatus] = React.useState<string | null>(null);

  const templatesQuery = useCommunicationTemplates();
  const createMutation = useCreateTemplateMutation();
  const updateMutation = useUpdateTemplateMutation();
  const deleteMutation = useDeleteTemplateMutation();
  const sendMutation = useSendCommunicationMutation();

  const templates = templatesQuery.data?.data ?? [];

  function closeForm() {
    setFormMode({ kind: "hidden" });
    setFormError(null);
  }

  async function handleCreate(data: CreateTemplateRequest) {
    setFormError(null);
    try {
      await createMutation.mutateAsync(data);
      closeForm();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create template",
      );
    }
  }

  async function handleUpdate(id: string, data: CreateTemplateRequest) {
    setFormError(null);
    try {
      await updateMutation.mutateAsync({ id, body: data });
      closeForm();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update template",
      );
    }
  }

  async function handleDelete(template: CommunicationTemplate) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete template "${template.name}"?`)
    ) {
      return;
    }
    setDeletingId(template.id);
    try {
      await deleteMutation.mutateAsync({ id: template.id });
    } catch {
      // refetch shows truth
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSendTest(template: CommunicationTemplate) {
    if (typeof window === "undefined") return;
    const recipient = window.prompt(
      `Send a test ${template.channel} message to:`,
      "",
    );
    if (!recipient) return;
    setSendingId(template.id);
    setSendStatus(null);
    try {
      await sendMutation.mutateAsync({
        templateId: template.id,
        channel: template.channel,
        recipient,
      });
      setSendStatus(`Test message queued for ${recipient}.`);
    } catch (err) {
      setSendStatus(
        err instanceof Error ? `Send failed: ${err.message}` : "Send failed.",
      );
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Communications
          </h1>
          <p className="text-sm text-slate-500">
            Manage email, SMS, and WhatsApp templates and inspect delivery
            history.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PollIndicator
            isFetching={templatesQuery.isFetching}
            isError={templatesQuery.isError}
            dataUpdatedAt={templatesQuery.dataUpdatedAt}
            onRetry={() => templatesQuery.refetch()}
          />
          {formMode.kind === "hidden" ? (
            <Button onClick={() => setFormMode({ kind: "create" })}>
              New template
            </Button>
          ) : null}
        </div>
      </header>

      {sendStatus && (
        <div
          role="status"
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        >
          {sendStatus}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          {formMode.kind !== "hidden" && (
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">
                {formMode.kind === "edit" ? "Edit template" : "New template"}
              </h2>
              <TemplateForm
                initial={
                  formMode.kind === "edit" ? formMode.template : null
                }
                isSubmitting={
                  createMutation.isPending || updateMutation.isPending
                }
                error={formError}
                onCancel={closeForm}
                submitLabel={
                  formMode.kind === "edit"
                    ? "Save changes"
                    : "Create template"
                }
                onSubmit={(data) => {
                  if (formMode.kind === "edit") {
                    void handleUpdate(formMode.template.id, data);
                  } else {
                    void handleCreate(data);
                  }
                }}
              />
            </div>
          )}

          {templatesQuery.isError ? (
            <ErrorBanner
              message="Failed to load templates."
              onRetry={() => templatesQuery.refetch()}
            />
          ) : templatesQuery.isLoading ? (
            <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              No templates yet. Click &ldquo;New template&rdquo; to create one.
            </div>
          ) : (
            <ul role="list" className="space-y-2">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="rounded-md border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {t.name}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-700">
                          {t.channel}
                        </span>
                        {t.isActive === false && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            inactive
                          </span>
                        )}
                      </div>
                      {t.subject && (
                        <p className="mt-1 text-xs text-slate-500">
                          Subject: {t.subject}
                        </p>
                      )}
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {t.bodyTemplate}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFormMode({ kind: "edit", template: t })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={sendingId === t.id}
                        onClick={() => void handleSendTest(t)}
                      >
                        {sendingId === t.id ? "Sending…" : "Send test"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === t.id}
                        onClick={() => void handleDelete(t)}
                      >
                        {deletingId === t.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <CommunicationLogsList />
      </div>
    </div>
  );
}
