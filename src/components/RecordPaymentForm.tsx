"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ErrorBanner";
import { RecordPaymentRequestSchema, type RecordPaymentRequest } from "@/types/api";
import type { MilestoneWithDerivedStatus } from "@/hooks/usePaymentMilestones";

interface RecordPaymentFormProps {
  milestones: MilestoneWithDerivedStatus[];
  defaultMilestoneId?: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: RecordPaymentRequest) => void;
  onCancel: () => void;
}

const PAYMENT_MODES = ["cheque", "NEFT", "RTGS", "cash", "UPI"] as const;

type FieldErrors = Partial<Record<keyof RecordPaymentRequest, string>>;

export function RecordPaymentForm({
  milestones,
  defaultMilestoneId,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: RecordPaymentFormProps) {
  const unpaid = milestones.filter((m) => m.derivedStatus !== "paid");

  const [milestoneId, setMilestoneId] = React.useState(defaultMilestoneId ?? "");
  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState<RecordPaymentRequest["mode"]>("NEFT");
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = {
      milestoneId,
      amount: parseFloat(amount),
      mode,
      referenceNumber: referenceNumber || undefined,
      notes: notes || undefined,
    };
    const result = RecordPaymentRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof RecordPaymentRequest;
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
        <label className="block text-sm font-medium text-slate-700">Milestone</label>
        <select
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select milestone</option>
          {unpaid.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {fieldErrors.milestoneId && (
          <p className="text-xs text-red-600">{fieldErrors.milestoneId}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Amount (₹)</label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {fieldErrors.amount && (
          <p className="text-xs text-red-600">{fieldErrors.amount}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Payment Mode</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {mode !== "cash" && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            Reference / Cheque Number
          </label>
          <Input
            type="text"
            placeholder="e.g. TXN123456"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Notes <span className="text-slate-400">(optional)</span>
        </label>
        <Input
          type="text"
          maxLength={500}
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
          {isSubmitting ? "Saving…" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
