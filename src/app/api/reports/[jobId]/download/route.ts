import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/api";

/**
 * GET /api/reports/[jobId]/download — proxy the file payload from the backend
 * to the browser. The response body is streamed through unchanged; we forward
 * Content-Type and Content-Disposition so the browser triggers a download with
 * the upstream-provided filename.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;

  const upstream = await proxyFetch(
    req,
    `/reports/${encodeURIComponent(jobId)}/download`,
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

  const headers = new Headers();
  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";
  headers.set("Content-Type", contentType);

  const disposition = upstream.headers.get("content-disposition");
  if (disposition) {
    headers.set("Content-Disposition", disposition);
  } else {
    headers.set(
      "Content-Disposition",
      `attachment; filename="report-${jobId}"`,
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
