import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { normalizeReportJob, normalizeReportJobs } from "@/lib/reportJob";
import {
  GenerateReportRequestSchema,
  ReportJobSchema,
  ReportJobsResponseSchema,
} from "@/types/api";

/**
 * Translate the client's flat generate-report body into the backend's
 * `CreateReportDto` ({ reportType, format, filters? }).
 *
 * The backend runs a global `ValidationPipe({ forbidNonWhitelisted: true })`,
 * so forwarding `dateFrom` / `dateTo` / `projectId` at the top level 400s the
 * whole request with "property dateFrom should not exist" — which is exactly
 * what happened every time a user picked a date on the Generate report form.
 * Those three are report *filters*; `filters` is the field the DTO accepts
 * (it lands in `report_jobs.filters`/`parameters`).
 */
function toCreateReportDto(body: {
  reportType: string;
  format: string;
  dateFrom?: string;
  dateTo?: string;
  projectId?: string;
}): Record<string, unknown> {
  const filters: Record<string, string> = {};
  if (body.dateFrom) filters.dateFrom = body.dateFrom;
  if (body.dateTo) filters.dateTo = body.dateTo;
  if (body.projectId) filters.projectId = body.projectId;

  const dto: Record<string, unknown> = {
    reportType: body.reportType,
    format: body.format,
  };
  if (Object.keys(filters).length > 0) dto.filters = filters;
  return dto;
}

/**
 * GET /api/reports — list report jobs.
 * Proxies to backend GET /reports. On upstream 404 returns an empty
 * `{ jobs: [] }` envelope so the UI renders an empty state while the backend
 * endpoint is still being delivered.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/reports");

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (upstream.status === 404) {
    return NextResponse.json({ jobs: [] }, { status: 200 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_error" },
      { status: upstream.status },
    );
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }

  // Backend `GET /reports` answers with a bare array of `report_jobs` rows
  // keyed on `id`. Rename to `jobId` and strip the nulls the client schema
  // rejects, otherwise every row fails `ReportJobsResponseSchema` and
  // `useReportJobs` silently falls back to an empty list.
  if (Array.isArray(json)) {
    json = { jobs: normalizeReportJobs(json) };
  } else if (
    json &&
    typeof json === "object" &&
    Array.isArray((json as { jobs?: unknown }).jobs)
  ) {
    json = {
      ...(json as object),
      jobs: normalizeReportJobs((json as { jobs: unknown[] }).jobs),
    };
  } else if (
    json &&
    typeof json === "object" &&
    Array.isArray((json as { data?: unknown }).data)
  ) {
    json = { jobs: normalizeReportJobs((json as { data: unknown[] }).data) };
  }

  const parsedJobs = ReportJobsResponseSchema.safeParse(json);
  if (!parsedJobs.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsedJobs.data, { status: 200 });
}

/**
 * POST /api/reports — generate a report job.
 * Body validated against GenerateReportRequestSchema before calling upstream.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsedBody = GenerateReportRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, "/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toCreateReportDto(parsedBody.data)),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try {
      errBody = await upstream.json();
    } catch {
      // keep default
    }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  // Same `id` → `jobId` rename as the list route, so the mutation's resolved
  // value is a real `ReportJob` the caller can poll on.
  const created = ReportJobSchema.safeParse(normalizeReportJob(json));
  if (!created.success) {
    // Non-fatal: the job WAS queued upstream. Hand back the raw row rather
    // than failing a successful write on a cosmetic shape difference.
    return NextResponse.json(json, { status: 201 });
  }
  return NextResponse.json(created.data, { status: 201 });
}
