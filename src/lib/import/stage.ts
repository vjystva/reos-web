/**
 * Generic staging engine for the bulk-CSV importer.
 *
 * This is the leads-only pipeline from `src/lib/leadImport.ts` (`stageRows` /
 * `applyExistingMatches` / `buildImportCsv`) lifted to run against any
 * `EntityImportConfig`. `src/lib/leadImport.ts` is deliberately left in place
 * and untouched: it is the shipped reference, it has its own unit tests, and
 * `src/lib/import/leads.ts` re-uses its field list, phone rules and sample
 * fixture rather than restating them.
 *
 * Issue ORDER is part of the contract — the leads screen has always listed
 * missing-required first, then per-cell problems in field order, then
 * cross-field, then duplicates, then the row cap. Preserved here so the leads
 * flow renders identically.
 */

import { toCsv } from "@/lib/csv";
import {
  MAX_IMPORT_ROWS,
  type EntityImportConfig,
  type ExistingMatch,
  type ImportContext,
  type RowIssue,
  type StagedRow,
} from "./types";

/** A row that will be sent to the backend: no issues at all. */
export function isReady(row: StagedRow): boolean {
  return row.issues.length === 0;
}

export function isDuplicate(row: StagedRow): boolean {
  return row.issues.some(
    (i) => i.kind === "duplicate_existing" || i.kind === "duplicate_in_file",
  );
}

/** Target field keys that must be mapped before the import can run. */
export function requiredFieldKeys(config: EntityImportConfig): string[] {
  return config.fields.filter((f) => f.required).map((f) => f.key);
}

/**
 * Applies the column mapping to the parsed rows and validates each one the way
 * the backend importer will. Anything needing a network round-trip (the leads
 * duplicate probe) is layered on afterwards by `applyExistingMatches`.
 */
export function stageRows(
  config: EntityImportConfig,
  headers: string[],
  rows: string[][],
  mapping: Record<string, string>,
  ctx: ImportContext = {},
): StagedRow[] {
  const colIndex: Record<string, number> = {};
  for (const field of config.fields) {
    const header = mapping[field.key];
    colIndex[field.key] = header ? headers.indexOf(header) : -1;
  }

  const requiredKeys = requiredFieldKeys(config);
  /** dedupe key -> zero-based index of the first row that used it. */
  const seen = new Map<string, number>();

  return rows.map((cells, index) => {
    const values: Record<string, string> = {};
    for (const field of config.fields) {
      const i = colIndex[field.key];
      values[field.key] = i >= 0 ? (cells[i] ?? "").trim() : "";
    }

    const issues: RowIssue[] = [];

    // 1. Required cells, grouped into a single readable issue.
    const missing = requiredKeys.filter((k) => !values[k]);
    if (missing.length > 0) {
      const labels = missing
        .map((k) => config.fields.find((f) => f.key === k)?.label ?? k)
        .join(" / ");
      issues.push({ kind: "missing_required", message: `Missing ${labels}` });
    }

    // 2. Per-cell validation, in field declaration order. Blank cells are
    //    skipped — an omitted optional column is not an error.
    for (const field of config.fields) {
      const value = values[field.key];
      if (!value || !field.validate) continue;
      const message = field.validate(value);
      if (message) issues.push({ kind: "invalid_value", message });
    }

    // 3. Cross-field rules (bookings' reference groups, units' tower rule).
    if (config.validateRow) issues.push(...config.validateRow(values, ctx));

    // 4. In-file duplicates.
    if (config.dedupe) {
      const key = config.dedupe.key(values);
      if (key) {
        const firstAt = seen.get(key);
        if (firstAt !== undefined) {
          const noun = config.dedupe.noun ? `${config.dedupe.noun} ` : "";
          issues.push({
            kind: "duplicate_in_file",
            message: `Duplicate ${noun}of row ${firstAt + 1} in this file`,
          });
        } else {
          seen.set(key, index);
        }
      }
    }

    // 5. Row cap. Non-blocking for the file as a whole: the rows before the
    //    cap still import.
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
 * Folds duplicate pre-check results into the staged rows. `keyOf` derives the
 * same comparison key the probe was keyed on (phone digits, for leads).
 * Returns a new array; input is not mutated.
 */
export function applyExistingMatches(
  rows: StagedRow[],
  matches: Map<string, ExistingMatch>,
  keyOf: (values: Record<string, string>) => string,
  describe: (match: ExistingMatch) => string = (m) =>
    `Duplicate of ${m.name || "existing record"} (${m.id})`,
): StagedRow[] {
  if (matches.size === 0) return rows;
  return rows.map((row) => {
    const hit = matches.get(keyOf(row.values));
    if (!hit) return row;
    return {
      ...row,
      existing: hit,
      issues: [
        ...row.issues.filter((i) => i.kind !== "duplicate_existing"),
        { kind: "duplicate_existing" as const, message: describe(hit) },
      ],
    };
  });
}

/**
 * Builds the canonical CSV payload from the ready rows only.
 *
 * Every field key is emitted as a header, mapped or not. That is deliberate:
 * the bookings importer requires at least one header from each reference group
 * to be PRESENT, and a blank cell in an emitted column is treated as absent by
 * every backend coercion helper (`csvText` returns undefined for ""), so a
 * full header row is always safe and never changes row semantics.
 *
 * Returns the CSV text plus `lineNumbers`, where `lineNumbers[n]` is the
 * original spreadsheet line for submitted data row `n + 1`. The backend
 * reports rejections as `row = dataRowIndex + 2`, so
 * `lineNumbers[rejected.row - 2]` maps a rejection back to the source row.
 */
export function buildImportCsv(
  config: EntityImportConfig,
  rows: StagedRow[],
): { csv: string; lineNumbers: number[] } {
  const headers = config.fields.map((f) => f.key);
  const body = rows.map((r) => headers.map((h) => r.values[h] ?? ""));
  return {
    csv: toCsv(headers, body),
    lineNumbers: rows.map((r) => r.lineNumber),
  };
}
