"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import { KYC_LABEL } from "@/lib/partnerPerformance";
import {
  CreateDealerRequestSchema,
  DEALER_KYC_STATUSES,
  DEFAULT_DEALER_KYC_STATUS,
  type CreateDealerRequest,
  type Dealer,
  type DealerKycStatus,
} from "@/types/api";

/** Dense field label recipe — matches the lead + filter surfaces. */
const LABEL = "block text-[11px] uppercase tracking-wider text-muted-foreground";
/** Inline per-field validation message. */
const FIELD_ERROR = "text-[11px] text-destructive";
const OPTIONAL = "normal-case tracking-normal text-muted-foreground/70";

interface DealerFormProps {
  /** When provided the form is in edit mode and pre-populates from this dealer. */
  initial?: Dealer | null;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateDealerRequest) => void;
  onCancel: () => void;
  submitLabel?: string;
}

type FieldErrors = Partial<Record<keyof CreateDealerRequest, string>>;

export function DealerForm({
  initial,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  submitLabel,
}: DealerFormProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [phone, setPhone] = React.useState(initial?.phone ?? "");
  const [company, setCompany] = React.useState(initial?.company ?? "");
  const [commissionRate, setCommissionRate] = React.useState<string>(
    initial?.commissionRate != null ? String(initial.commissionRate) : "",
  );
  const [reraId, setReraId] = React.useState(initial?.reraId ?? "");
  const [kycStatus, setKycStatus] = React.useState<DealerKycStatus>(
    initial?.kycStatus ?? DEFAULT_DEALER_KYC_STATUS,
  );
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw: Record<string, unknown> = {
      name: name.trim(),
      // Always sent (even when blank) so the schema reports "Email required"
      // inline rather than zod's generic "expected string, received undefined".
      // The backend requires it — see CreateDealerRequestSchema.
      email: email.trim(),
      // Always sent: the select is never empty, and 'pending' matches the DB
      // default so a create with an untouched select is a no-op.
      kycStatus,
    };
    if (phone.trim()) raw.phone = phone.trim();
    if (company.trim()) raw.company = company.trim();
    if (commissionRate.trim()) {
      const n = Number(commissionRate);
      if (!Number.isNaN(n)) raw.commissionRate = n;
    }
    // Explicit null when the field is cleared on an existing dealer so the
    // PATCH actually wipes `rera_id`; omitted entirely on a blank create.
    if (reraId.trim()) {
      raw.reraId = reraId.trim();
    } else if (initial?.reraId) {
      raw.reraId = null;
    }

    const result = CreateDealerRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateDealerRequest;
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
        <label className={LABEL} htmlFor="dealer-name">
          Name
        </label>
        <Input
          id="dealer-name"
          type="text"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Realty"
          required
        />
        {fieldErrors.name && <p className={FIELD_ERROR}>{fieldErrors.name}</p>}
      </div>

      {/* Required — `dealers.email` is NOT NULL and CreateDealerDto declares
          `@IsEmail()` without `@IsOptional()`. Labelling this "(optional)" is
          what made a name-only submit 400 at the backend. */}
      <div className="space-y-1">
        <label className={LABEL} htmlFor="dealer-email">
          Email
        </label>
        <Input
          id="dealer-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contact@acme.example"
          required
        />
        {fieldErrors.email && <p className={FIELD_ERROR}>{fieldErrors.email}</p>}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="dealer-phone">
          Phone <span className={OPTIONAL}>(optional)</span>
        </label>
        <Input
          id="dealer-phone"
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98xxx xxxxx"
          className="font-mono tabular-nums"
        />
        {fieldErrors.phone && <p className={FIELD_ERROR}>{fieldErrors.phone}</p>}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="dealer-company">
          Company <span className={OPTIONAL}>(optional)</span>
        </label>
        <Input
          id="dealer-company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Realty Pvt Ltd"
        />
        {fieldErrors.company && (
          <p className={FIELD_ERROR}>{fieldErrors.company}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="dealer-commission">
          Commission rate (%) <span className={OPTIONAL}>(optional)</span>
        </label>
        <Input
          id="dealer-commission"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={commissionRate}
          onChange={(e) => setCommissionRate(e.target.value)}
          placeholder="2.5"
          className="font-mono tabular-nums"
        />
        {fieldErrors.commissionRate && (
          <p className={FIELD_ERROR}>{fieldErrors.commissionRate}</p>
        )}
      </div>

      {/* Compliance pair — RERA registration id + KYC standing. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className={LABEL} htmlFor="dealer-rera-id">
            RERA id <span className={OPTIONAL}>(optional)</span>
          </label>
          <Input
            id="dealer-rera-id"
            type="text"
            maxLength={64}
            value={reraId}
            onChange={(e) => setReraId(e.target.value)}
            placeholder="UPRERAAGT10234"
            className="font-mono"
          />
          {fieldErrors.reraId && (
            <p className={FIELD_ERROR}>{fieldErrors.reraId}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className={LABEL} htmlFor="dealer-kyc-status">
            KYC status
          </label>
          <Select
            id="dealer-kyc-status"
            value={kycStatus}
            onChange={(e) => setKycStatus(e.target.value as DealerKycStatus)}
          >
            {DEALER_KYC_STATUSES.map((s) => (
              <option key={s} value={s}>
                {KYC_LABEL[s]}
              </option>
            ))}
          </Select>
          {fieldErrors.kycStatus && (
            <p className={FIELD_ERROR}>{fieldErrors.kycStatus}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : (submitLabel ?? "Create dealer")}
        </Button>
      </div>
    </form>
  );
}
