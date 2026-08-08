"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import { inr } from "@/lib/utils";
import { paymentModeLabel } from "@/lib/bookingTone";
import {
  PAYMENT_MODES,
  RecordPaymentRequestSchema,
  type RecordPaymentRequest,
} from "@/types/api";
import type { MilestoneWithDerivedStatus } from "@/hooks/usePaymentMilestones";

/** Dense field label recipe — matches the rest of the booking surfaces. */
const LABEL = "block text-[11px] uppercase tracking-wider text-muted-foreground";
/** Inline per-field validation message. */
const FIELD_ERROR = "text-[11px] text-destructive";
const OPTIONAL = "normal-case tracking-normal text-muted-foreground/70";

interface RecordPaymentFormProps {
  /**
   * Required — the BFF builds `POST /bookings/:bookingId/payments` from it.
   * There is no top-level `/payments` endpoint upstream.
   */
  bookingId: string;
  milestones: MilestoneWithDerivedStatus[];
  defaultMilestoneId?: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: RecordPaymentRequest) => void;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof RecordPaymentRequest, string>>;

/** YYYY-MM-DD in local time — what `<input type="date">` expects. */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function RecordPaymentForm({
  bookingId,
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
  // Backend `RecordPaymentDto.paymentMode` is @IsIn(PAYMENT_MODES) with
  // lowercase values — the old "NEFT"/"RTGS"/"UPI" spellings 400'd.
  const [paymentMode, setPaymentMode] =
    React.useState<RecordPaymentRequest["paymentMode"]>("neft");
  // `paymentDate` is REQUIRED upstream (@IsDateString). It was missing
  // entirely from the old payload, so every submit 400'd even with a valid
  // mode.
  const [paymentDate, setPaymentDate] = React.useState(today());
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  React.useEffect(() => {
    setMilestoneId(defaultMilestoneId ?? "");
  }, [defaultMilestoneId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = {
      bookingId,
      milestoneId,
      amount: parseFloat(amount),
      paymentDate,
      paymentMode,
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
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label className={LABEL} htmlFor="payment-milestone">
          Milestone
        </label>
        <Select
          id="payment-milestone"
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
        >
          <option value="">Select milestone</option>
          {unpaid.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {inr(Math.max(0, m.dueAmount - m.amountPaid))} due
            </option>
          ))}
        </Select>
        {fieldErrors.milestoneId && (
          <p className={FIELD_ERROR}>{fieldErrors.milestoneId}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="payment-amount">
          Amount (₹)
        </label>
        <Input
          id="payment-amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          className="font-mono tabular-nums"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {fieldErrors.amount && (
          <p className={FIELD_ERROR}>{fieldErrors.amount}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="payment-date">
          Payment date
        </label>
        <Input
          id="payment-date"
          type="date"
          className="font-mono tabular-nums"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
        {fieldErrors.paymentDate && (
          <p className={FIELD_ERROR}>{fieldErrors.paymentDate}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="payment-mode">
          Payment mode
        </label>
        <Select
          id="payment-mode"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}
        >
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {paymentModeLabel(m)}
            </option>
          ))}
        </Select>
        {fieldErrors.paymentMode && (
          <p className={FIELD_ERROR}>{fieldErrors.paymentMode}</p>
        )}
      </div>

      {paymentMode !== "cash" && (
        <div className="space-y-1">
          <label className={LABEL} htmlFor="payment-reference">
            Reference / cheque number
          </label>
          <Input
            id="payment-reference"
            type="text"
            placeholder="e.g. TXN123456"
            className="font-mono"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1">
        <label className={LABEL} htmlFor="payment-notes">
          Notes <span className={OPTIONAL}>(optional)</span>
        </label>
        <Input
          id="payment-notes"
          type="text"
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {fieldErrors.notes && <p className={FIELD_ERROR}>{fieldErrors.notes}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
