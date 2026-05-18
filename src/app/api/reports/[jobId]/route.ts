import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";
import { ReportJobSchema } from "@/types/api";

/**
 * GET /api/reports/[jobId] — single report job status.
 * Proxies to GET /reports/:jobId. Upstream 404 is forwarded as-is so the
 * polling hook can stop on a missing job.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  const upstream = await proxyFetch(
    req,
    `/reports/${encodeURIComponent(jobId)}`,
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
  const parsed = ReportJobSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "upstream_shape_mismatch" },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data, { status: 200 });
}
