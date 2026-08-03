/**
 * Dependency-free CSV parsing / serialising.
 *
 * Scope: enough of RFC 4180 for the bulk lead import screen —
 *   - quoted fields, embedded commas / newlines, doubled `""` escapes
 *   - CRLF, CR or LF line endings
 *   - UTF-8 BOM stripping (Excel exports)
 *   - blank lines skipped, ragged rows padded / not truncated
 *
 * Deliberately NOT a general parser: no custom delimiters, no comment lines,
 * no type coercion. The backend (`csv-parse/sync` in
 * `leads/csv-import.service.ts`) is the authority on the final parse; this is
 * only for the client-side preview + column mapping.
 */

export interface ParsedCsv {
  /** Header row, trimmed. Empty array when the input has no content. */
  headers: string[];
  /** Data rows. Each row is padded to `headers.length`. */
  rows: string[][];
}

/** Splits CSV text into a matrix of raw cells. */
function splitRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAnyChar = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    // Skip records that are entirely empty (e.g. trailing newline).
    if (!(row.length === 1 && row[0].trim() === "")) records.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.trim() === "") {
      // Opening quote — discard any leading whitespace before it.
      field = "";
      inQuotes = true;
      sawAnyChar = true;
      continue;
    }
    if (ch === ",") {
      endField();
      sawAnyChar = true;
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRecord();
      continue;
    }
    if (ch === "\n") {
      endRecord();
      continue;
    }
    field += ch;
    sawAnyChar = true;
  }

  if (field !== "" || row.length > 0 || sawAnyChar) endRecord();
  return records;
}

/**
 * Parses CSV text into `{ headers, rows }`. Never throws — malformed input
 * degrades to best-effort cells so the preview can still render.
 */
export function parseCsv(input: string): ParsedCsv {
  let text = input ?? "";
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  if (text.trim() === "") return { headers: [], rows: [] };

  const records = splitRecords(text);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = (records[0] ?? []).map((h) => h.trim());
  const width = headers.length;
  const rows = records.slice(1).map((r) => {
    const cells = r.map((c) => c.trim());
    while (cells.length < width) cells.push("");
    return cells;
  });
  return { headers, rows };
}

/** Quotes a single cell if it contains a delimiter, quote or newline. */
export function escapeCsvCell(value: string): string {
  const v = value ?? "";
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Serialises a header row + data rows back to CSV text (CRLF line endings). */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCsvCell).join(","));
  return lines.join("\r\n");
}

/**
 * Canonical form used for fuzzy header matching: lowercase, alphanumerics
 * only. `"Client E-Mail "` → `"clientemail"`.
 */
export function normalizeHeader(header: string): string {
  return (header ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface GuessTarget {
  /** Canonical destination column name, e.g. `first_name`. */
  key: string;
  /** Extra header spellings that should match this target. */
  aliases?: string[];
}

/**
 * Auto-maps CSV headers onto target fields.
 *
 * Two passes, matching the reference behaviour:
 *   1. exact match on the normalised key / alias
 *   2. substring match (either direction) on the normalised key / alias
 *
 * A CSV header is consumed by at most one target; earlier targets win.
 * Unmatched targets map to `""`.
 */
export function guessMapping(
  headers: string[],
  targets: GuessTarget[],
): Record<string, string> {
  const result: Record<string, string> = {};
  const taken = new Set<string>();
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  const candidates = (t: GuessTarget) =>
    [t.key, ...(t.aliases ?? [])].map(normalizeHeader).filter(Boolean);

  // Pass 1 — exact.
  for (const target of targets) {
    result[target.key] = "";
    const wanted = candidates(target);
    const hit = normalized.find(
      (h) => !taken.has(h.raw) && h.norm !== "" && wanted.includes(h.norm),
    );
    if (hit) {
      result[target.key] = hit.raw;
      taken.add(hit.raw);
    }
  }

  // Pass 2 — substring, only for targets still unmapped.
  for (const target of targets) {
    if (result[target.key]) continue;
    const wanted = candidates(target);
    const hit = normalized.find(
      (h) =>
        !taken.has(h.raw) &&
        h.norm !== "" &&
        wanted.some((w) => h.norm.includes(w) || w.includes(h.norm)),
    );
    if (hit) {
      result[target.key] = hit.raw;
      taken.add(hit.raw);
    }
  }

  return result;
}
