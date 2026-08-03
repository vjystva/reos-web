"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CreateDealerRequestSchema,
  type CreateDealerRequest,
  type Dealer,
} from "@/types/api";

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
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw: Record<string, unknown> = {
      name: name.trim(),
    };
    if (email.trim()) raw.email = email.trim();
    if (phone.trim()) raw.phone = phone.trim();
    if (company.trim()) raw.company = company.trim();
    if (commissionRate.trim()) {
      const n = Number(commissionRate);
      if (!Number.isNaN(n)) raw.commissionRate = n;
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="dealer-name"
        >
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
        {fieldErrors.name && (
          <p className="text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="dealer-email"
        >
          Email <span className="text-slate-400">(optional)</span>
        </label>
        <Input
          id="dealer-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contact@acme.example"
        />
        {fieldErrors.email && (
          <p className="text-xs text-red-600">{fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="dealer-phone"
        >
          Phone <span className="text-slate-400">(optional)</span>
        </label>
        <Input
          id="dealer-phone"
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98xxx xxxxx"
        />
        {fieldErrors.phone && (
          <p className="text-xs text-red-600">{fieldErrors.phone}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="dealer-company"
        >
          Company <span className="text-slate-400">(optional)</span>
        </label>
        <Input
          id="dealer-company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Realty Pvt Ltd"
        />
        {fieldErrors.company && (
          <p className="text-xs text-red-600">{fieldErrors.company}</p>
        )}
      </div>

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor="dealer-commission"
        >
          Commission rate (%){" "}
          <span className="text-slate-400">(optional)</span>
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
        />
        {fieldErrors.commissionRate && (
          <p className="text-xs text-red-600">{fieldErrors.commissionRate}</p>
        )}
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
          {isSubmitting ? "Saving…" : (submitLabel ?? "Create dealer")}
        </Button>
      </div>
    </form>
  );
}
