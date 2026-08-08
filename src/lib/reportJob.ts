/**
 * Report-job wire normalisation (BFF layer).
 *
 * The backend `report_jobs` row (see reos-backend
 * `src/reports/entities/report-job.entity.ts`) is serialised as:
 *
 *   { id, tenantId, reportType, status, parameters, result, errorMessage,
 *     createdAt, updatedAt, format, filters, rowCount, downloadUrl,
 *     completedAt }
 *
 * The client contract (`ReportJobSchema` in `src/types/api.ts`) expects
 * `jobId` — NOT `id` — and rejects `null` for `format`, `rowCount`,
 * `downloadUrl` and `completedAt` (those are `z.<t>().optional()`, not
 * `.nullable()`).
 *
 * Before this helper existed, `GET /api/reports` forwarded the raw rows and
 * `ReportJobsResponseSchema.safeParse` failed on EVERY job. `useReportJobs`
 * treats a parse failure as "no data" and returns `{ jobs: [] }`, so the
 * "Recent exports" panel on /dashboard/reports rendered
 * "No reports generated yet" no matter how many jobs the tenant had. Silent,
 * permanent, and invisible in the network tab (the request was a clean 200).
 *
 * Everything below is a pure rename / null-strip. No values are invented:
 * `format` falls back to 'csv' only because the legacy `report_jobs.format`
 * column is NOT NULL with a `('csv','json')` CHECK — a null can only come from
 * a row written by the newer `/reports/jobs` queue path, whose payloads are
 * always CSV-shaped exports.
 */

const REPORT_FORMAT_VALUES = ["csv", "json"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Drop a key entirely when the upstream value is null/undefined. */
function optional(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value !== null && value !== undefined) target[key] = value;
}

/**
 * Map one upstream `report_jobs` row onto the client `ReportJob` shape.
 * Unknown extra keys are preserved (`ReportJobSchema` is `.passthrough()`).
 * Non-object input is returned untouched so the caller's schema still gets to
 * produce the real error.
 */
export function normalizeReportJob(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;

  const out: Record<string, unknown> = { ...raw };

  // `id` → `jobId`. Keep `id` too; the schema passes unknown keys through.
  const jobId = raw["jobId"] ?? raw["id"];
  if (typeof jobId === "string") out["jobId"] = jobId;

  // `format` is nullable on rows created via POST /reports/jobs.
  const format = raw["format"];
  out["format"] =
    typeof format === "string" &&
    (REPORT_FORMAT_VALUES as readonly string[]).includes(format)
      ? format
      : "csv";

  // Null → absent for the fields the client schema declares non-nullable.
  delete out["rowCount"];
  delete out["downloadUrl"];
  delete out["completedAt"];
  optional(out, "rowCount", raw["rowCount"]);
  optional(out, "downloadUrl", raw["downloadUrl"]);
  optional(out, "completedAt", raw["completedAt"]);

  return out;
}

/** `normalizeReportJob` over a list; non-array input passes straight through. */
export function normalizeReportJobs(raw: unknown): unknown {
  return Array.isArray(raw) ? raw.map(normalizeReportJob) : raw;
}

/**
 * `POST /reports/jobs/:id/run` answers with the whole updated job row, but the
 * client contract (`RunReportJobResponseSchema`) is the narrow
 * `{ jobId, status }` pair. Reduce, don't reshape.
 */
export function toRunReportJobResponse(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const jobId = raw["jobId"] ?? raw["id"];
  return { jobId, status: raw["status"] };
}
