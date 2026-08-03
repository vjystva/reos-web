"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CreateLeadRequestSchema,
  LEAD_SOURCES,
  type CreateLeadRequest,
} from "@/types/api";

const SOURCE_LABELS: Record<string, string> = {
  web_form: "Website / Web Form",
  whatsapp: "WhatsApp",
  phone: "Phone Call",
  csv_import: "CSV Import",
  third_party_api: "Agent / Referral",
};

/** Dense field label recipe — matches the rest of the lead surfaces. */
const LABEL = "block text-[11px] uppercase tracking-wider text-muted-foreground";
/** Inline per-field validation message. */
const FIELD_ERROR = "text-[11px] text-destructive";
const OPTIONAL = "normal-case tracking-normal text-muted-foreground/70";

interface CreateLeadFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateLeadRequest) => void;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof CreateLeadRequest, string>>;

export function CreateLeadForm({
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: CreateLeadFormProps) {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [source, setSource] = React.useState<string>("phone");
  const [budgetMin, setBudgetMin] = React.useState("");
  const [budgetMax, setBudgetMax] = React.useState("");
  const [preferredLocation, setPreferredLocation] = React.useState("");
  const [projectInterest, setProjectInterest] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw: Record<string, unknown> = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      source,
    };
    if (email.trim()) raw.email = email.trim();
    if (budgetMin.trim()) raw.budgetMin = Number(budgetMin);
    if (budgetMax.trim()) raw.budgetMax = Number(budgetMax);
    if (preferredLocation.trim()) raw.preferredLocation = preferredLocation.trim();
    if (projectInterest.trim()) raw.projectInterest = projectInterest.trim();

    const result = CreateLeadRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateLeadRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className={LABEL} htmlFor="lead-first-name">
            First Name
          </label>
          <Input
            id="lead-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Rahul"
            maxLength={120}
            required
          />
          {fieldErrors.firstName && <p className={FIELD_ERROR}>{fieldErrors.firstName}</p>}
        </div>
        <div className="space-y-1">
          <label className={LABEL} htmlFor="lead-last-name">
            Last Name
          </label>
          <Input
            id="lead-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Sharma"
            maxLength={120}
            required
          />
          {fieldErrors.lastName && <p className={FIELD_ERROR}>{fieldErrors.lastName}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="lead-phone">
          Phone
        </label>
        <Input
          id="lead-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98765 43210"
          className="font-mono tabular-nums"
          required
        />
        {fieldErrors.phone && <p className={FIELD_ERROR}>{fieldErrors.phone}</p>}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="lead-email">
          Email <span className={OPTIONAL}>(optional)</span>
        </label>
        <Input
          id="lead-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="rahul@example.com"
        />
        {fieldErrors.email && <p className={FIELD_ERROR}>{fieldErrors.email}</p>}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="lead-source">
          Lead Source
        </label>
        <Select
          id="lead-source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>
          ))}
        </Select>
        {fieldErrors.source && <p className={FIELD_ERROR}>{fieldErrors.source}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className={LABEL} htmlFor="lead-budget-min">
            Budget Min ₹ <span className={OPTIONAL}>(optional)</span>
          </label>
          <Input
            id="lead-budget-min"
            type="number"
            min={0}
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            placeholder="5000000"
            className="font-mono tabular-nums"
          />
          {fieldErrors.budgetMin && <p className={FIELD_ERROR}>{fieldErrors.budgetMin}</p>}
        </div>
        <div className="space-y-1">
          <label className={LABEL} htmlFor="lead-budget-max">
            Budget Max ₹ <span className={OPTIONAL}>(optional)</span>
          </label>
          <Input
            id="lead-budget-max"
            type="number"
            min={0}
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            placeholder="15000000"
            className="font-mono tabular-nums"
          />
          {fieldErrors.budgetMax && <p className={FIELD_ERROR}>{fieldErrors.budgetMax}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="lead-location">
          Location Preference <span className={OPTIONAL}>(optional)</span>
        </label>
        <Input
          id="lead-location"
          value={preferredLocation}
          onChange={(e) => setPreferredLocation(e.target.value)}
          placeholder="Noida Sector 62"
          maxLength={200}
        />
        {fieldErrors.preferredLocation && (
          <p className={FIELD_ERROR}>{fieldErrors.preferredLocation}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="lead-project-interest">
          Project Interest <span className={OPTIONAL}>(optional)</span>
        </label>
        <Input
          id="lead-project-interest"
          value={projectInterest}
          onChange={(e) => setProjectInterest(e.target.value)}
          placeholder="3 BHK, Green Valley"
          maxLength={200}
        />
        {fieldErrors.projectInterest && (
          <p className={FIELD_ERROR}>{fieldErrors.projectInterest}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add lead"}
        </Button>
      </div>
    </form>
  );
}
