/**
 * Bookings import config.
 *
 * Backend: `POST /bookings/import/csv`
 * (`@Roles('sales_agent','sales_manager','builder_admin','dealer')`) via BFF
 * `POST /api/bookings/import`.
 *
 * A booking needs a `leads.id` and a `units.id`, neither of which a sales-ops
 * person has in a spreadsheet. The backend's primary contract is therefore
 * human-friendly lookup, with raw UUIDs as an escape hatch — and this config
 * mirrors that ordering, listing the UUID columns last and flagged `advanced`:
 *
 *   lead  <- lead_phone / lead_email   (ANDed when both present)  |  lead_id
 *   unit  <- unit_number + project_name (+ optional tower_name)   |  unit_id
 *
 * What the client can check: that SOME reference is present, and that
 * `project_name` accompanies `unit_number`. What it deliberately cannot check:
 * whether the reference resolves to exactly one record, and whether the unit
 * is actually available. Those are per-row rejections ("ambiguous lead",
 * "ambiguous unit", "Unit is not available for booking") surfaced verbatim.
 */

import type { EntityImportConfig, RowIssue } from "./types";
import { emailCell, maxLenCell, numberCell, uuidCell } from "./validators";

export const bookingsImportConfig: EntityImportConfig = {
  key: "bookings",
  label: "Bookings",
  noun: { one: "booking", many: "bookings" },
  description:
    "Books units against existing leads. Reference the lead by phone or email and the unit by number + project.",
  fields: [
    {
      key: "lead_phone",
      label: "Lead phone",
      required: false,
      hint: "Matched exactly against the stored lead phone",
      aliases: ["customer phone", "buyer phone", "mobile", "phone"],
      validate: maxLenCell("Lead phone", 50),
    },
    {
      key: "lead_email",
      label: "Lead email",
      required: false,
      hint: "ANDed with phone when both are present",
      aliases: ["customer email", "buyer email", "email"],
      validate: emailCell("Lead email"),
    },
    {
      key: "unit_number",
      label: "Unit number",
      required: false,
      aliases: ["unit no", "unit", "flat no", "flat number"],
      validate: maxLenCell("Unit number", 50),
    },
    {
      key: "project_name",
      label: "Project name",
      required: false,
      hint: "Required whenever you match by unit number",
      aliases: ["project", "property", "development"],
      validate: maxLenCell("Project name", 255),
    },
    {
      key: "tower_name",
      label: "Tower name",
      required: false,
      hint: "Only needed to disambiguate a repeated unit number",
      aliases: ["tower", "block", "wing"],
      validate: maxLenCell("Tower name", 255),
    },
    {
      key: "booking_amount",
      label: "Booking amount",
      required: true,
      aliases: ["amount", "booking value", "total amount", "consideration"],
      validate: numberCell("Booking amount", { min: 0 }),
    },
    {
      key: "notes",
      label: "Notes",
      required: false,
      aliases: ["remarks", "comment", "comments"],
      validate: maxLenCell("Notes", 2000),
    },
    {
      key: "lead_id",
      label: "Lead id",
      required: false,
      advanced: true,
      hint: "Escape hatch — overrides phone/email lookup",
      aliases: ["leadid", "lead uuid"],
      validate: uuidCell("Lead id"),
    },
    {
      key: "unit_id",
      label: "Unit id",
      required: false,
      advanced: true,
      hint: "Escape hatch — overrides unit number lookup",
      aliases: ["unitid", "unit uuid"],
      validate: uuidCell("Unit id"),
    },
  ],
  sampleCsv: [
    "Customer Phone,Customer Email,Unit No,Project,Tower,Amount,Remarks",
    "+91 98765 43210,rahul.sharma@example.com,A-1101,Skyline Heights,Tower A,9500000,Cheque received",
    "+91 99860 11223,ananya.iyer@example.com,B-102,Skyline Heights,Tower B,7200000,",
    // Deliberately invalid: unit number given with no project to qualify it.
    "+91 90080 55412,vikram.nair@example.com,C-901,,,6100000,Missing project",
  ].join("\n"),
  sampleFileName: "sample-bookings.csv",
  uploadFileName: "bookings.csv",
  placeholder:
    "lead_phone,unit_number,project_name,booking_amount\n+91 98765 43210,A-1101,Skyline Heights,9500000",
  endpoint: () => "/api/bookings/import",
  invalidateKeys: ["bookings", "units", "inventory", "metrics"],
  dedupe: {
    // A unit can carry only one active booking, so two rows targeting the same
    // unit can never both succeed — flag the second before submitting.
    key: (v) =>
      v.unit_id
        ? `id:${v.unit_id.toLowerCase()}`
        : v.unit_number
          ? `n:${v.project_name.toLowerCase()}|${v.tower_name.toLowerCase()}|${v.unit_number.toLowerCase()}`
          : "",
    hint: "same unit booked twice in this file",
    noun: "unit",
  },
  validateRow: (values): RowIssue[] => {
    const issues: RowIssue[] = [];

    if (!values.lead_id && !values.lead_phone && !values.lead_email) {
      issues.push({
        kind: "cross_field",
        message: "Needs a lead reference (phone, email or lead id)",
      });
    }
    if (!values.unit_id && !values.unit_number) {
      issues.push({
        kind: "cross_field",
        message: "Needs a unit reference (unit number or unit id)",
      });
    }
    // `unit_number` alone is not unique within a tenant, so the backend
    // requires the project to qualify it. `unit_id` bypasses the lookup.
    if (!values.unit_id && values.unit_number && !values.project_name) {
      issues.push({
        kind: "cross_field",
        message: "Project name is required when matching by unit number",
      });
    }
    return issues;
  },
  previewColumns: () => [
    {
      header: "Lead",
      className: "font-medium text-foreground",
      render: (row) =>
        row.values.lead_phone ||
        row.values.lead_email ||
        row.values.lead_id ||
        "—",
    },
    {
      header: "Unit",
      className: "font-mono",
      render: (row) => row.values.unit_number || row.values.unit_id || "—",
    },
    {
      header: "Project / tower",
      className: "text-muted-foreground",
      render: (row) =>
        [row.values.project_name, row.values.tower_name]
          .filter(Boolean)
          .join(" · ") || "—",
    },
    {
      header: "Amount",
      numeric: true,
      className: "whitespace-nowrap text-muted-foreground",
      render: (row) => {
        const raw = row.values.booking_amount.replace(/[, ]/g, "");
        const n = Number(raw);
        if (!raw || !Number.isFinite(n)) return row.values.booking_amount || "—";
        return new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
          notation: "compact",
        }).format(n);
      },
    },
    {
      header: "Notes",
      className: "text-muted-foreground",
      render: (row) => row.values.notes || "—",
    },
  ],
  previewNote: (
    <>
      The preview can only confirm that a reference is <em>present</em>. Whether
      it resolves to exactly one lead/unit, and whether that unit is still
      available, is decided per row on the server — those rejections are shown
      verbatim after submit.
    </>
  ),
  resultNote: () => (
    <>
      Each imported booking mints a <code>BK-…</code> number and drives its unit
      from <code>available</code> to <code>blocked</code> in the same
      transaction.
    </>
  ),
};
