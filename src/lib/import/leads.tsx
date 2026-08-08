/**
 * Leads import config.
 *
 * This is the ORIGINAL importer, re-expressed as an `EntityImportConfig`. It
 * imports its field list, phone regex, phone-comparison key and sample fixture
 * from `src/lib/leadImport.ts` rather than restating them, so the shipped
 * leads behaviour stays single-sourced and cannot drift as the generic shell
 * evolves.
 *
 * Backend: `POST /leads/import/csv` (`@Roles('sales_manager','builder_admin')`)
 * via BFF `POST /api/leads/import`.
 *
 * Leads is the only entity with a server-side duplicate PROBE: there is no
 * dedupe endpoint and no unique constraint on `leads.phone`, so the screen
 * searches existing leads by phone before submit. Advisory only.
 */

import * as React from "react";
import {
  IMPORT_FIELDS,
  PHONE_RE,
  SAMPLE_CSV,
  phoneKey,
} from "@/lib/leadImport";
import type { EntityImportConfig, ImportFieldDef } from "./types";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Budget cells: commas/spaces stripped, must be finite and >= 0 — exactly
 * `parseNumberCell` in `leadImport.ts`.
 */
function budgetCell(label: string) {
  return (value: string): string | null => {
    const n = Number(value.replace(/[, ]/g, ""));
    return Number.isFinite(n) && n >= 0 ? null : `Invalid ${label}`;
  };
}

/**
 * Validators keyed by field. Messages are byte-identical to the ones the
 * leads screen has always shown — `e2e/16-import.spec.ts` asserts on them.
 */
const LEAD_VALIDATORS: Record<string, (value: string) => string | null> = {
  phone: (v) => (PHONE_RE.test(v) ? null : "Invalid phone format"),
  email: (v) => (EMAIL_RE.test(v) ? null : "Invalid email"),
  budget_min: budgetCell("Budget min"),
  budget_max: budgetCell("Budget max"),
};

const FIELDS: ImportFieldDef[] = IMPORT_FIELDS.map((f) => ({
  ...f,
  validate: LEAD_VALIDATORS[f.key],
}));

function formatBudget(min: string, max: string): string {
  const clean = (v: string) => v.replace(/[, ]/g, "");
  if (!clean(min) && !clean(max)) return "—";
  const fmt = (v: string) => {
    const n = Number(clean(v));
    return Number.isFinite(n) && v.trim() !== ""
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
          notation: "compact",
        }).format(n)
      : "—";
  };
  return `${fmt(min)} – ${fmt(max)}`;
}

export const leadsImportConfig: EntityImportConfig = {
  key: "leads",
  label: "Leads",
  noun: { one: "lead", many: "leads" },
  description:
    "Creates leads at stage new with source csv_import. Owners are resolved server-side by the tenant's routing configuration.",
  fields: FIELDS,
  sampleCsv: SAMPLE_CSV,
  sampleFileName: "sample-leads.csv",
  uploadFileName: "leads.csv",
  placeholder:
    "first_name,last_name,phone,email\nRahul,Sharma,+91 98765 43210,rahul@example.com",
  endpoint: () => "/api/leads/import",
  invalidateKeys: ["leads", "metrics"],
  supportsExistingCheck: true,
  dedupe: {
    // Digits only, last 10 — so "+91 98450 77219" and "9845077219" collide.
    key: (v) => phoneKey(v.phone),
    hint: "same phone twice in this file",
  },
  previewColumns: (ctx) => [
    {
      header: "Name",
      className: "font-medium text-foreground",
      render: (row) =>
        [row.values.first_name, row.values.last_name]
          .filter(Boolean)
          .join(" ") || "—",
    },
    {
      header: "Phone",
      className: "font-mono",
      render: (row) => row.values.phone || "—",
    },
    {
      header: "Email",
      className: "text-muted-foreground",
      render: (row) => row.values.email || "—",
    },
    {
      header: "Budget",
      className: "whitespace-nowrap text-muted-foreground",
      render: (row) =>
        formatBudget(row.values.budget_min, row.values.budget_max),
    },
    {
      header: "Location / project",
      className: "text-muted-foreground",
      render: (row) =>
        [row.values.preferred_location, row.values.project_interest]
          .filter(Boolean)
          .join(" · ") || "—",
    },
    {
      header: "Owner",
      render: () => (
        <span
          className="text-muted-foreground"
          title="The importer assigns each lead on the server using the tenant's routing configuration."
        >
          {ctx.assignmentLabel ? `Auto · ${ctx.assignmentLabel}` : "Auto"}
        </span>
      ),
    },
  ],
  previewNote: (
    <>
      Duplicate detection is advisory: the importer has no server-side dedupe,
      so it matches each phone number against existing leads via lead search
      before you submit. Numbers stored in a different format may not be found.
    </>
  ),
  resultNote: (ctx) => (
    <>
      Imported leads enter the pipeline at stage <code>new</code> with source{" "}
      <code>csv_import</code> and are assigned automatically
      {ctx.assignmentLabel ? ` (${ctx.assignmentLabel.toLowerCase()})` : ""}.
    </>
  ),
};
