"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CreateWorkflowRequestSchema,
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_TRIGGER_TYPES,
  type CreateWorkflowRequest,
  type WorkflowActionType,
  type WorkflowTriggerType,
} from "@/types/api";

interface CreateWorkflowFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateWorkflowRequest) => void;
}

interface ConfigRow {
  key: string;
  value: string;
}

interface ActionDraft {
  actionType: WorkflowActionType;
  config: ConfigRow[];
}

type FieldErrors = {
  name?: string;
  triggerType?: string;
  actions?: string;
};

function freshAction(): ActionDraft {
  return { actionType: "send_notification", config: [] };
}

function buildConfig(rows: ConfigRow[]): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    out[k] = row.value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function CreateWorkflowForm({
  isSubmitting,
  error,
  onSubmit,
}: CreateWorkflowFormProps) {
  const [name, setName] = React.useState("");
  const [triggerType, setTriggerType] =
    React.useState<WorkflowTriggerType>("lead_created");
  const [actions, setActions] = React.useState<ActionDraft[]>([freshAction()]);
  const [isActive, setIsActive] = React.useState<boolean>(true);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function updateAction(idx: number, patch: Partial<ActionDraft>) {
    setActions((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    );
  }

  function addAction() {
    setActions((prev) => [...prev, freshAction()]);
  }

  function removeAction(idx: number) {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addConfigRow(actionIdx: number) {
    setActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx
          ? { ...a, config: [...a.config, { key: "", value: "" }] }
          : a,
      ),
    );
  }

  function updateConfigRow(
    actionIdx: number,
    rowIdx: number,
    patch: Partial<ConfigRow>,
  ) {
    setActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx
          ? {
              ...a,
              config: a.config.map((r, j) =>
                j === rowIdx ? { ...r, ...patch } : r,
              ),
            }
          : a,
      ),
    );
  }

  function removeConfigRow(actionIdx: number, rowIdx: number) {
    setActions((prev) =>
      prev.map((a, i) =>
        i === actionIdx
          ? { ...a, config: a.config.filter((_, j) => j !== rowIdx) }
          : a,
      ),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw = {
      name: name.trim(),
      triggerType,
      actions: actions.map((a) => {
        const config = buildConfig(a.config);
        return config
          ? { actionType: a.actionType, config }
          : { actionType: a.actionType };
      }),
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
    // Reset
    setName("");
    setTriggerType("lead_created");
    setActions([freshAction()]);
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
          value={triggerType}
          onChange={(e) =>
            setTriggerType(e.target.value as WorkflowTriggerType)
          }
        >
          {WORKFLOW_TRIGGER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        {fieldErrors.triggerType && (
          <p className="text-xs text-red-600">{fieldErrors.triggerType}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">
            Actions
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAction}
          >
            Add action
          </Button>
        </div>
        {fieldErrors.actions && (
          <p className="text-xs text-red-600">{fieldErrors.actions}</p>
        )}

        <ul role="list" className="space-y-3">
          {actions.map((a, idx) => (
            <li
              key={idx}
              className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <label
                    className="block text-xs font-medium text-slate-600"
                    htmlFor={`workflow-action-${idx}`}
                  >
                    Action type
                  </label>
                  <Select
                    id={`workflow-action-${idx}`}
                    value={a.actionType}
                    onChange={(e) =>
                      updateAction(idx, {
                        actionType: e.target.value as WorkflowActionType,
                      })
                    }
                  >
                    {WORKFLOW_ACTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </Select>
                </div>
                {actions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove action ${idx + 1}`}
                    onClick={() => removeAction(idx)}
                    className="mt-5"
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">
                    Config
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addConfigRow(idx)}
                  >
                    Add field
                  </Button>
                </div>
                {a.config.length > 0 && (
                  <ul className="space-y-1.5">
                    {a.config.map((row, rowIdx) => (
                      <li
                        key={rowIdx}
                        className="flex items-center gap-2"
                      >
                        <Input
                          aria-label={`Action ${idx + 1} config key ${rowIdx + 1}`}
                          type="text"
                          value={row.key}
                          onChange={(e) =>
                            updateConfigRow(idx, rowIdx, {
                              key: e.target.value,
                            })
                          }
                          placeholder="key"
                          className="flex-1"
                        />
                        <Input
                          aria-label={`Action ${idx + 1} config value ${rowIdx + 1}`}
                          type="text"
                          value={row.value}
                          onChange={(e) =>
                            updateConfigRow(idx, rowIdx, {
                              value: e.target.value,
                            })
                          }
                          placeholder="value"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove field ${rowIdx + 1} from action ${idx + 1}`}
                          onClick={() => removeConfigRow(idx, rowIdx)}
                        >
                          ×
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
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
