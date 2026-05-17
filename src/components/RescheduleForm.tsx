"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  RescheduleVisitRequestSchema,
  type RescheduleVisitRequest,
} from "@/types/api";

interface RescheduleFormProps {
  defaultVisitDate?: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: RescheduleVisitRequest) => void;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof RescheduleVisitRequest, string>>;

/**
 * `<input type="datetime-local">` produces values like "2026-05-17T14:30"
 * (no timezone, no seconds). We convert to a Date and pass the full ISO
 * string to the backend so the contract stays UTC.
 */
function toIsoLocal(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toISOString();
}

/**
 * Convert backend ISO string to the value shape `datetime-local` expects.
 */
function isoToInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // YYYY-MM-DDTHH:MM in local timezone.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RescheduleForm({
  defaultVisitDate,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: RescheduleFormProps) {
  const [visitDate, setVisitDate] = React.useState(isoToInputValue(defaultVisitDate));
  const [notes, setNotes] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = {
      visitDate: toIsoLocal(visitDate),
      notes: notes || undefined,
    };
    const result = RescheduleVisitRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof RescheduleVisitRequest;
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
        <label className="block text-sm font-medium text-slate-700" htmlFor="reschedule-visit-date">
          New visit date &amp; time
        </label>
        <Input
          id="reschedule-visit-date"
          type="datetime-local"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
        />
        {fieldErrors.visitDate && (
          <p className="text-xs text-red-600">{fieldErrors.visitDate}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="reschedule-notes">
          Notes <span className="text-slate-400">(optional)</span>
        </label>
        <Input
          id="reschedule-notes"
          type="text"
          maxLength={500}
          placeholder="Customer requested a later slot"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {fieldErrors.notes && (
          <p className="text-xs text-red-600">{fieldErrors.notes}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Reschedule"}
        </Button>
      </div>
    </form>
  );
}
