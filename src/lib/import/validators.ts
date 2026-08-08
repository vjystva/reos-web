/**
 * Cell validators for the generic CSV importer.
 *
 * Each one mirrors a coercion helper in
 * `reos-backend/src/common/csv-import/csv-import.util.ts` (`csvNumber`,
 * `csvEnum`, `csvBool`, `csvEmail`, `csvIsoDate`, `csvUuid`) plus the
 * class-validator constraint the corresponding DTO applies. The point is that
 * a row the preview marks "Ready" is a row the backend will accept, so the
 * only rejections a user ever sees are the ones the client genuinely cannot
 * know about (unknown tower, ambiguous lead, unit already booked).
 *
 * Every validator is called ONLY with a non-blank, trimmed value.
 */

/** Same shape check the backend's `csvEmail` uses. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NumberCellOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  /** class-validator `@IsNumber({ maxDecimalPlaces })`. */
  maxDecimals?: number;
}

/**
 * Numeric cell. Thousands separators and stray spaces are tolerated exactly
 * as `csvNumber` tolerates them (`"1,250.50"` -> 1250.5), because real Excel
 * exports contain them.
 */
export function numberCell(label: string, opts: NumberCellOptions = {}) {
  return (value: string): string | null => {
    const n = Number(value.replace(/[, ]/g, ""));
    if (!Number.isFinite(n)) return `${label} is not a number`;
    if (opts.integer && !Number.isInteger(n)) {
      return `${label} must be a whole number`;
    }
    if (opts.min !== undefined && n < opts.min) {
      return `${label} must be at least ${opts.min}`;
    }
    if (opts.max !== undefined && n > opts.max) {
      return `${label} must be at most ${opts.max}`;
    }
    if (opts.maxDecimals !== undefined) {
      const decimals = (value.replace(/[, ]/g, "").split(".")[1] ?? "").length;
      if (decimals > opts.maxDecimals) {
        return `${label} allows at most ${opts.maxDecimals} decimal places`;
      }
    }
    return null;
  };
}

/** Allow-list cell, compared case-insensitively like `csvEnum`. */
export function enumCell(label: string, allowed: readonly string[]) {
  return (value: string): string | null => {
    const v = value.toLowerCase();
    return allowed.some((a) => a.toLowerCase() === v)
      ? null
      : `${label} must be one of ${allowed.join(" | ")}`;
  };
}

/** true/false/yes/no/y/n/1/0, matching `csvBool`. */
const TRUE_VALUES = new Set(["true", "yes", "y", "1"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0"]);

export function boolCell(label: string) {
  return (value: string): string | null => {
    const v = value.toLowerCase();
    return TRUE_VALUES.has(v) || FALSE_VALUES.has(v)
      ? null
      : `${label} must be true/false, yes/no or 1/0`;
  };
}

export function emailCell(label: string) {
  return (value: string): string | null =>
    EMAIL_RE.test(value) ? null : `${label} is not a valid email`;
}

/** ISO-8601 date or datetime, matching `csvIsoDate`'s `Date.parse` check. */
export function isoDateCell(label: string) {
  return (value: string): string | null =>
    Number.isNaN(Date.parse(value))
      ? `${label} must be an ISO date, e.g. 2026-03-31`
      : null;
}

export function uuidCell(label: string) {
  return (value: string): string | null =>
    UUID_RE.test(value) ? null : `${label} must be a UUID`;
}

/** `@MaxLength(n)` on the destination DTO field. */
export function maxLenCell(label: string, max: number) {
  return (value: string): string | null =>
    value.length > max ? `${label} exceeds ${max} characters` : null;
}

/** Runs several validators, reporting the first failure. */
export function allOf(
  ...validators: Array<(value: string) => string | null>
) {
  return (value: string): string | null => {
    for (const v of validators) {
      const msg = v(value);
      if (msg) return msg;
    }
    return null;
  };
}
