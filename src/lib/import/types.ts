/**
 * Shared model for the generic bulk-CSV import screen (`/dashboard/import`).
 *
 * The screen used to be leads-only. It is now a shell driven by one
 * `EntityImportConfig` per importable entity, so the file input, "Load sample
 * CSV", column mapping, staged preview and result summary are written ONCE and
 * parameterised — see `src/lib/import/index.ts` for the registry.
 *
 * Every rule expressed through this type mirrors a REAL backend rule. The
 * authorities are:
 *
 *   leads     reos-backend/src/leads/csv-import.service.ts
 *   units     reos-backend/src/units/units-csv-import.service.ts
 *   dealers   reos-backend/src/dealers/dealers-csv-import.service.ts
 *   bookings  reos-backend/src/bookings/bookings-csv-import.service.ts
 *   tasks     reos-backend/src/tasks/tasks-csv-import.service.ts
 *   shared    reos-backend/src/common/csv-import/csv-import.util.ts
 *
 * All five endpoints share one wire contract: multipart field `file`, 5 MB
 * cap, 500-row cap, headers normalised `trim().toLowerCase().replace(/\s+/g,'_')`,
 * response `{ imported, rejected: [{ row, reason }] }` where `row` is 1-indexed
 * and counts the header line.
 */

import type * as React from "react";
import type { GuessTarget } from "@/lib/csv";
import type { ProjectType } from "@/types/api";

/**
 * Row / byte caps, single-sourced from the original leads importer so the two
 * can never drift. Backend equivalents: `CSV_MAX_ROWS`, `CSV_MAX_FILE_BYTES`.
 */
export { MAX_IMPORT_ROWS } from "@/lib/leadImport";
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportEntityKey =
  | "leads"
  | "units"
  | "dealers"
  | "bookings"
  | "tasks";

/**
 * One mappable destination column.
 *
 * `key` is the EXACT header name the backend importer reads — it is what
 * `buildImportCsv` writes into the generated file, so it must never be a
 * display alias.
 */
export interface ImportFieldDef extends GuessTarget {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
  /**
   * Escape-hatch columns (raw UUIDs). Rendered in a separate, de-emphasised
   * group in the mapping panel: correct but not what a spreadsheet normally
   * contains.
   */
  advanced?: boolean;
  /**
   * Cell validation, run ONLY when the cell is non-blank (a blank required
   * cell is already reported as `missing_required`). Returns the issue
   * message, or `null` when the value is acceptable.
   */
  validate?: (value: string) => string | null;
}

export type RowIssueKind =
  | "missing_required"
  | "invalid_value"
  | "cross_field"
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
  /** Populated when a duplicate pre-check found an existing record. */
  existing?: ExistingMatch;
  /** Rejection reason returned by the backend after submit — verbatim. */
  rejection?: string;
}

/**
 * Runtime facts a config may need that are not in the CSV itself.
 *
 * `projectId` / `projectType` exist because the Units importer is scoped to a
 * single project by URL and its tower rules depend on the project's type.
 */
export interface ImportContext {
  projectId?: string;
  projectType?: ProjectType;
  /** Leads only: the tenant's resolved routing mode label. */
  assignmentLabel?: string | null;
}

export interface PreviewColumn {
  header: string;
  numeric?: boolean;
  className?: string;
  render: (row: StagedRow) => React.ReactNode;
}

export interface EntityImportConfig {
  key: ImportEntityKey;
  /** Picker label, e.g. "Units". */
  label: string;
  /** Used in copy: "Import 3 units". */
  noun: { one: string; many: string };
  /** One-line explanation shown under the picker. */
  description: string;

  fields: ImportFieldDef[];

  /** Demo data behind "Load sample CSV" — deliberately includes a bad row. */
  sampleCsv: string;
  sampleFileName: string;
  /** Filename attached to the generated multipart part. Cosmetic. */
  uploadFileName: string;
  /** Textarea placeholder showing a minimal valid header line. */
  placeholder: string;

  /** BFF route this entity submits to. */
  endpoint: (ctx: ImportContext) => string;
  /** Units: a project must be chosen before mapping is meaningful. */
  requiresProject?: boolean;

  /** react-query key prefixes invalidated after a successful import. */
  invalidateKeys: string[];

  /**
   * In-file duplicate detection. Omit entirely for entities with no natural
   * key (tasks) — the UI then hides the Duplicates tile rather than showing a
   * meaningless zero.
   */
  dedupe?: {
    /** Returns "" when the row has nothing to dedupe on. */
    key: (values: Record<string, string>) => string;
    /** Tile hint, e.g. "same email twice in this file". */
    hint: string;
    /**
     * Inserted into the issue text: "Duplicate <noun> of row N in this file".
     * Omitted for leads to preserve its established wording exactly.
     */
    noun?: string;
  };

  /**
   * Leads only: there is a server-side duplicate PROBE (lead search by phone).
   * No other entity has an equivalent, so the "Check duplicates" button and
   * the existing-record tile hint are gated on this.
   */
  supportsExistingCheck?: boolean;

  /** Cross-field validation the per-cell validators cannot express. */
  validateRow?: (
    values: Record<string, string>,
    ctx: ImportContext,
  ) => RowIssue[];

  previewColumns: (ctx: ImportContext) => PreviewColumn[];
  previewNote?: React.ReactNode;
  resultNote?: (ctx: ImportContext) => React.ReactNode;
}
