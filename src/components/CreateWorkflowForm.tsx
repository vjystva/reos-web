"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CreateWorkflowRequestSchema,
  WORKFLOW_TRIGGER_EVENTS,
  type CreateWorkflowRequest,
  type WorkflowTriggerEvent,
} from "@/types/api";

interface CreateWorkflowFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateWorkflowRequest) => void;
}

type FieldErrors = {
  name?: string;
  triggerEvent?: string;
};

export function CreateWorkflowForm({
  isSubmitting,
  error,
  onSubmit,
}: CreateWorkflowFormProps) {
  const [name, setName] = React.useState("");
  const [triggerEvent, setTriggerEvent] =
    React.useState<WorkflowTriggerEvent>("lead_stage_changed");
  const [isActive, setIsActive] = React.useState<boolean>(true);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw = {
      name: name.trim(),
      triggerEvent,
      isActive,
    };

    const result = CreateWorkflowRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
    setName("");
    setTriggerEvent("lead_stage_changed");
    setIsActive(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="workflow-name"
        >
          Name
        </label>
        <Input
          id="workflow-name"
          type="text"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Notify dealer on hot lead"
          required
        />
        {fieldErrors.name && (
          <p className="text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="workflow-trigger"
        >
          Trigger
        </label>
        <Select
          id="workflow-trigger"
          value={triggerEvent}
          onChange={(e) =>
            setTriggerEvent(e.target.value as WorkflowTriggerEvent)
          }
        >
          {WORKFLOW_TRIGGER_EVENTS.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        {fieldErrors.triggerEvent && (
          <p className="text-xs text-red-600">{fieldErrors.triggerEvent}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="workflow-active"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <label htmlFor="workflow-active" className="text-sm text-slate-700">
          Active on create
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create workflow"}
        </Button>
      </div>
    </form>
  );
}
