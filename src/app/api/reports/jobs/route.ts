import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { z } from "zod";

const ReportJobItemSchema = z.object({
  id: z.string(),
  tenantId: z.string().optional(),
  reportType: z.string(),
  status: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  format: z.string().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).nullable().optional(),
  rowCount: z.number().nullable().optional(),
  downloadUrl: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
}).passthrough();

const PaginatedJobsSchema = z.object({
  data: z.array(ReportJobItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

const QueueJobBodySchema = z.object({
  reportType: z.enum(["leads", "bookings", "payments", "site_visits"]),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/reports/jobs — list report jobs (paginated).
 * Proxies to backend GET /reports/jobs.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstream = await proxyFetch(req, "/reports/jobs");

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "upstream_error" }, { status: upstream.status });
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }

  const parsed = PaginatedJobsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(parsed.data, { status: 200 });
}

/**
 * POST /api/reports/jobs — queue a new report job.
 * Proxies to backend POST /reports/jobs.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsedBody = QueueJobBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const upstream = await proxyFetch(req, "/reports/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsedBody.data),
  });

  if (upstream.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!upstream.ok) {
    let errBody: unknown = { error: "upstream_error" };
    try { errBody = await upstream.json(); } catch { /* keep default */ }
    return NextResponse.json(errBody, { status: upstream.status });
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json({ error: "upstream_shape_mismatch" }, { status: 502 });
  }
  return NextResponse.json(json, { status: 201 });
}
