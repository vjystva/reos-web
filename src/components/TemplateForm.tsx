"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  COMMUNICATION_CHANNELS,
  CreateTemplateRequestSchema,
  type CommunicationChannel,
  type CommunicationTemplate,
  type CreateTemplateRequest,
} from "@/types/api";

interface TemplateFormProps {
  /** Pre-populates the form in edit mode. */
  initial?: CommunicationTemplate | null;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateTemplateRequest) => void;
  onCancel: () => void;
  submitLabel?: string;
}

type FieldErrors = Partial<Record<keyof CreateTemplateRequest, string>>;

function splitVariables(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TemplateForm({
  initial,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  submitLabel,
}: TemplateFormProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [channel, setChannel] = React.useState<CommunicationChannel>(
    (initial?.channel as CommunicationChannel) ?? "email",
  );
  const [subject, setSubject] = React.useState(initial?.subject ?? "");
  const [bodyTemplate, setBodyTemplate] = React.useState(
    initial?.bodyTemplate ?? "",
  );
  const [variables, setVariables] = React.useState(
    (initial?.variables ?? []).join(", "),
  );
  const [isActive, setIsActive] = React.useState<boolean>(
    initial?.isActive ?? true,
  );
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw: Record<string, unknown> = {
      name: name.trim(),
      channel,
      bodyTemplate: bodyTemplate.trim(),
      isActive,
    };
    if (channel === "email" && subject.trim()) {
      raw.subject = subject.trim();
    }
    const vars = splitVariables(variables);
    if (vars.length > 0) raw.variables = vars;

    const result = CreateTemplateRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateTemplateRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="template-name"
        >
          Name
        </label>
        <Input
          id="template-name"
          type="text"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Welcome email"
          required
        />
        {fieldErrors.name && (
          <p className="text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="template-channel"
        >
          Channel
        </label>
        <Select
          id="template-channel"
          value={channel}
          onChange={(e) =>
            setChannel(e.target.value as CommunicationChannel)
          }
        >
          {COMMUNICATION_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </Select>
        {fieldErrors.channel && (
          <p className="text-xs text-red-600">{fieldErrors.channel}</p>
        )}
      </div>

      {channel === "email" && (
        <div className="space-y-1">
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="template-subject"
          >
            Subject <span className="text-slate-400">(optional)</span>
          </label>
          <Input
            id="template-subject"
            type="text"
            maxLength={300}
            value={subject ?? ""}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Welcome to {{projectName}}"
          />
          {fieldErrors.subject && (
            <p className="text-xs text-red-600">{fieldErrors.subject}</p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="template-body"
        >
          Body
        </label>
        <textarea
          id="template-body"
          maxLength={10000}
          rows={5}
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          placeholder="Hello {{name}}, your unit {{unitNumber}} is ready."
          className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
          required
        />
        {fieldErrors.bodyTemplate && (
          <p className="text-xs text-red-600">{fieldErrors.bodyTemplate}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="template-variables"
        >
          Variables{" "}
          <span className="text-slate-400">(comma separated)</span>
        </label>
        <Input
          id="template-variables"
          type="text"
          value={variables}
          onChange={(e) => setVariables(e.target.value)}
          placeholder="name, projectName, unitNumber"
        />
        {fieldErrors.variables && (
          <p className="text-xs text-red-600">{fieldErrors.variables}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="template-active"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <label
          htmlFor="template-active"
          className="text-sm text-slate-700"
        >
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : (submitLabel ?? "Create template")}
        </Button>
      </div>
    </form>
  );
}
