/**
 * Client-side model for the bulk lead CSV import screen.
 *
 * Every rule here mirrors the *actual* backend importer
 * (`reos-backend/src/leads/csv-import.service.ts`) so the preview shown to the
 * user matches what the server will do:
 *
 *   endpoint  POST /leads/import/csv   (multipart, field name `file`)
 *   headers   first_name, last_name, phone, email, budget_min, budget_max,
 *             preferred_location, project_interest, external_ref
 *   required  first_name, last_name, phone   (missing header ⇒ whole file 400)
 *   phone     /^\+?[0-9][0-9\s-]{6,19}$/
 *   email     optional, must look like a@b.c
 *   budgets   optional, commas/spaces stripped, finite and >= 0
 *   cap       500 data rows, 5 MB file
 *   result    { imported: number, rejected: { row, reason }[] }
 *
 * The backend performs NO duplicate detection and NO unique constraint exists
 * on `leads.phone` — see `notes` in the import page for how duplicates are
 * surfaced instead.
 */

import { toCsv, type GuessTarget } from "./csv";

/** Hard cap enforced by the backend importer (`MAX_ROWS`). */
export const MAX_IMPORT_ROWS = 500;

export interface ImportField extends GuessTarget {
  label: string;
  required: boolean;
  hint?: string;
}

/**
 * Target columns, in the order they are rendered in the mapping panel.
 * `key` values are the exact header names the backend accepts.
 */
export const IMPORT_FIELDS: ImportField[] = [
  {
    key: "first_name",
    label: "First name",
    required: true,
    aliases: ["firstname", "given name", "fname", "name", "full name", "customer name", "lead name"],
  },
  {
    key: "last_name",
    label: "Last name",
    required: true,
    aliases: ["lastname", "surname", "family name", "lname"],
  },
  {
    key: "phone",
    label: "Phone",
    required: true,
    aliases: ["mobile", "mobile number", "phone number", "contact", "contact number", "msisdn"],
  },
  {
    key: "email",
    label: "Email",
    required: false,
    aliases: ["e-mail", "email address", "mail"],
  },
  {
    key: "budget_min",
    label: "Budget min",
    required: false,
    aliases: ["min budget", "budget from", "budget lower", "budget"],
  },
  {
    key: "budget_max",
    label: "Budget max",
    required: false,
    aliases: ["max budget", "budget to", "budget upper"],
  },
  {
    key: "preferred_location",
    label: "Preferred location",
    required: false,
    aliases: ["location", "locality", "area", "city", "preferred area"],
  },
  {
    key: "project_interest",
    label: "Project interest",
    required: false,
    aliases: ["project", "interested project", "property", "project name"],
  },
  {
    key: "external_ref",
    label: "External ref",
    required: false,
    hint: "Your CRM / portal id — stored for reconciliation",
    aliases: ["ref", "reference", "external id", "crm id", "lead id", "source id"],
  },
];

export const REQUIRED_FIELDS = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key);

/** Same expression the backend validates with. */
export const PHONE_RE = /^\+?[0-9][0-9\s-]{6,19}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Comparison key for duplicate matching: digits only, reduced to the last 10
 * so `+91 98450 77219` and `9845077219` are treated as the same subscriber.
 * (Backend stores the phone verbatim, formatting included.)
 */
export function phoneKey(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export type RowIssueKind =
  | "missing_required"
  | "invalid_phone"
  | "invalid_email"
  | "invalid_number"
  | "duplicate_in_file"
  | "duplicate_existing"
  | "over_row_cap";

export interface RowIssue {
  kind: RowIssueKind;
  message: string;
}

export interface ExistingMatch {
  id: string;
  name: string;
}

export interface StagedRow {
  /** Zero-based index into the parsed CSV data rows. */
  index: number;
  /** Line number as the user sees it in a spreadsheet (header = line 1). */
  lineNumber: number;
  /** Mapped values keyed by target field. */
  values: Record<string, string>;
  issues: RowIssue[];
  /** Populated when the duplicate pre-check found an existing lead. */
  existing?: ExistingMatch;
  /** Rejection reason returned by the backend after submit. */
  rejection?: string;
}

export function isBlocking(issue: RowIssue): boolean {
  return issue.kind !== "over_row_cap";
}

/** A row that will be sent to the backend: no issues at all. */
export function isReady(row: StagedRow): boolean {
  return row.issues.length === 0;
}

export function isDuplicate(row: StagedRow): boolean {
  return row.issues.some(
    (i) => i.kind === "duplicate_existing" || i.kind === "duplicate_in_file",
  );
}

function parseNumberCell(raw: string): { ok: boolean } {
  if (raw.trim() === "") return { ok: true };
  const n = Number(raw.replace(/[, ]/g, ""));
  return { ok: Number.isFinite(n) && n >= 0 };
}

/**
 * Applies the mapping to the parsed rows and validates each one exactly the way
 * the backend importer will. Duplicate-against-existing-leads is layered on
 * afterwards by `applyExistingMatches` (it needs a network round-trip).
 */
export function stageRows(
  headers: string[],
  rows: string[][],
  mapping: Record<string, string>,
): StagedRow[] {
  const colIndex: Record<string, number> = {};
  for (const field of IMPORT_FIELDS) {
    const header = mapping[field.key];
    colIndex[field.key] = header ? headers.indexOf(header) : -1;
  }

  const seenPhones = new Map<string, number>();

  return rows.map((cells, index) => {
    const values: Record<string, string> = {};
    for (const field of IMPORT_FIELDS) {
      const i = colIndex[field.key];
      values[field.key] = i >= 0 ? (cells[i] ?? "").trim() : "";
    }

    const issues: RowIssue[] = [];

    const missing = REQUIRED_FIELDS.filter((k) => !values[k]);
    if (missing.length > 0) {
      const labels = missing
        .map((k) => IMPORT_FIELDS.find((f) => f.key === k)?.label ?? k)
        .join(" / ");
      issues.push({ kind: "missing_required", message: `Missing ${labels}` });
    }

    if (values.phone && !PHONE_RE.test(values.phone)) {
      issues.push({ kind: "invalid_phone", message: "Invalid phone format" });
    }
    if (values.email && !EMAIL_RE.test(values.email)) {
      issues.push({ kind: "invalid_email", message: "Invalid email" });
    }
    for (const key of ["budget_min", "budget_max"] as const) {
      if (!parseNumberCell(values[key]).ok) {
        const label = IMPORT_FIELDS.find((f) => f.key === key)?.label ?? key;
        issues.push({ kind: "invalid_number", message: `Invalid ${label}` });
      }
    }

    const key = phoneKey(values.phone);
    if (key) {
      const firstAt = seenPhones.get(key);
      if (firstAt !== undefined) {
        issues.push({
          kind: "duplicate_in_file",
          message: `Duplicate of row ${firstAt + 1} in this file`,
        });
      } else {
        seenPhones.set(key, index);
      }
    }

    if (index >= MAX_IMPORT_ROWS) {
      issues.push({
        kind: "over_row_cap",
        message: `Beyond the ${MAX_IMPORT_ROWS}-row limit`,
      });
    }

    return { index, lineNumber: index + 2, values, issues };
  });
}

/**
 * Folds duplicate pre-check results (phone digits → existing lead) into the
 * staged rows. Returns a new array; input is not mutated.
 */
export function applyExistingMatches(
  rows: StagedRow[],
  matches: Map<string, ExistingMatch>,
): StagedRow[] {
  return rows.map((row) => {
    const hit = matches.get(phoneKey(row.values.phone));
    if (!hit) return row;
    return {
      ...row,
      existing: hit,
      issues: [
        ...row.issues.filter((i) => i.kind !== "duplicate_existing"),
        {
          kind: "duplicate_existing" as const,
          message: `Duplicate of ${hit.name || "existing lead"} (${hit.id})`,
        },
      ],
    };
  });
}

/**
 * Builds the CSV payload from the ready rows only.
 *
 * Returns the CSV text plus `lineNumbers`, where `lineNumbers[n]` is the
 * original spreadsheet line for submitted data row `n + 1`. The backend
 * reports rejections as `row = dataRowIndex + 2`, so
 * `lineNumbers[rejected.row - 2]` maps a rejection back to the source row.
 */
export function buildImportCsv(rows: StagedRow[]): {
  csv: string;
  lineNumbers: number[];
} {
  const headers = IMPORT_FIELDS.map((f) => f.key);
  const body = rows.map((r) => headers.map((h) => r.values[h] ?? ""));
  return {
    csv: toCsv(headers, body),
    lineNumbers: rows.map((r) => r.lineNumber),
  };
}

/** Demo data for the "Load sample CSV" affordance. */
export const SAMPLE_CSV = [
  "First Name,Last Name,Mobile Number,Email Address,Min Budget,Max Budget,Locality,Project,CRM Ref",
  "Rahul,Sharma,+91 98765 43210,rahul.sharma@example.com,8500000,11000000,Whitefield,Prestige Lakeside,CRM-1041",
  "Ananya,Iyer,+91 99860 11223,ananya.iyer@example.com,12000000,16000000,Indiranagar,Brigade Cornerstone,CRM-1042",
  "Vikram,Nair,+91 90080 55412,vikram.nair@example.com,6000000,7500000,Hebbal,Sobha Dream Acres,CRM-1043",
  "Meera,Krishnan,+91 98450 77219,,15000000,22000000,Koramangala,Prestige Lakeside,CRM-1044",
  "Imran,Qureshi,9845077219,imran.q@example.com,9000000,10500000,HSR Layout,Brigade Cornerstone,CRM-1045",
  "Deepa,,+91 97400 33810,deepa@example.com,5000000,6500000,Yelahanka,Sobha Dream Acres,CRM-1046",
].join("\n");
