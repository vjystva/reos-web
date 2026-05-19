"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CreateTicketRequestSchema,
  TICKET_PRIORITIES,
  type CreateTicketRequest,
  type TicketPriority,
} from "@/types/api";

interface CreateTicketFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateTicketRequest) => void;
}

type FieldErrors = Partial<Record<keyof CreateTicketRequest, string>>;

export function CreateTicketForm({
  isSubmitting,
  error,
  onSubmit,
}: CreateTicketFormProps) {
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<TicketPriority>("medium");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw = {
      subject: subject.trim(),
      description: description.trim(),
      priority,
    };
    const result = CreateTicketRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateTicketRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
    // Reset form after a successful submit dispatch — the page owns the
    // server round-trip, so we only clear locally controlled state.
    setSubject("");
    setDescription("");
    setPriority("medium");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="ticket-subject"
        >
          Subject
        </label>
        <Input
          id="ticket-subject"
          type="text"
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Cannot upload booking documents"
          required
        />
        {fieldErrors.subject && (
          <p className="text-xs text-red-600">{fieldErrors.subject}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="ticket-description"
        >
          Description
        </label>
        <textarea
          id="ticket-description"
          maxLength={5000}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue in as much detail as possible…"
          className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
          required
        />
        {fieldErrors.description && (
          <p className="text-xs text-red-600">{fieldErrors.description}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="ticket-priority"
        >
          Priority
        </label>
        <Select
          id="ticket-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
        >
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </Select>
        {fieldErrors.priority && (
          <p className="text-xs text-red-600">{fieldErrors.priority}</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create ticket"}
        </Button>
      </div>
    </form>
  );
}
