"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CancelVisitRequestSchema,
  type CancelVisitRequest,
} from "@/types/api";

interface CancelVisitFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CancelVisitRequest) => void;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof CancelVisitRequest, string>>;

export function CancelVisitForm({
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: CancelVisitFormProps) {
  const [reason, setReason] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = CancelVisitRequestSchema.safeParse({ reason });
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CancelVisitRequest;
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
        <label className="block text-sm font-medium text-slate-700" htmlFor="cancel-reason">
          Reason for cancellation
        </label>
        <Input
          id="cancel-reason"
          type="text"
          maxLength={500}
          placeholder="Customer no longer interested"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {fieldErrors.reason && (
          <p className="text-xs text-red-600">{fieldErrors.reason}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Keep visit
        </Button>
        <Button type="submit" variant="destructive" disabled={isSubmitting}>
          {isSubmitting ? "Cancelling…" : "Cancel visit"}
        </Button>
      </div>
    </form>
  );
}
