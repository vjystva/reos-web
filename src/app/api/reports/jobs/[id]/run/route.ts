import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { toRunReportJobResponse } from "@/lib/reportJob";
import { RunReportJobResponseSchema } from "@/types/api";

/**
 * POST /api/reports/jobs/[id]/run — trigger execution of a queued report job.
 *
 * Proxies to `POST /reports/jobs/:id/run` — note the `/jobs` segment. This
 * route previously called `POST /reports/:id/run`, which matches NO handler on
 * `ReportsController` (its run handler is declared `@Post('jobs/:id/run')`),
 * so every "Run Now" click came back 404 "Cannot POST /reports/<uuid>/run".
 *
 * The backend answers with the full updated `report_jobs` row keyed on `id`;
 * `RunReportJobResponseSchema` wants `{ jobId, status }`, hence the reduce.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const upstream = await proxyFetch(
    req,
    `/reports/jobs/${encodeURIComponent(id)}/run`,
    { method: "POST" },
  );

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
  const parsed = RunReportJobResponseSchema.safeParse(
    toRunReportJobResponse(json),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
