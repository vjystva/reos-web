"use client";

import * as React from "react";
import { GenerateReportRequestSchema, REPORT_FORMATS, type ReportJob } from "@/types/api";
import { useReportJobs } from "@/hooks/useReportJobs";
import { useQueueReportMutation } from "@/hooks/useQueueReportMutation";
import { useRunReportMutation } from "@/hooks/useRunReportMutation";
import { ErrorBanner } from "@/components/ErrorBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportTypeOption = {
  value: "leads_summary" | "bookings_summary" | "revenue_summary";
  label: string;
};

const REPORT_TYPE_OPTIONS: ReportTypeOption[] = [
  { value: "leads_summary", label: "Leads Summary" },
  { value: "bookings_summary", label: "Bookings Summary" },
  { value: "revenue_summary", label: "Revenue Summary" },
];

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-100 text-amber-800",
  running: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Result preview modal
// ---------------------------------------------------------------------------

function ResultModal({
  job,
  onClose,
}: {
  job: ReportJob;
  onClose: () => void;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          &times;
        </button>
        <h2
          id="result-modal-title"
          className="mb-4 text-base font-semibold text-slate-900"
        >
          Result — {job.jobId}
        </h2>
        <div className="mb-2 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>
            <span className="font-medium">Type:</span> {job.reportType}
          </span>
          <span>
            <span className="font-medium">Format:</span> {job.format}
          </span>
          {job.rowCount !== undefined && (
            <span>
              <span className="font-medium">Rows:</span> {job.rowCount}
            </span>
          )}
        </div>
        {job.downloadUrl && (
          <a
            href={job.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 inline-block text-sm text-blue-600 underline hover:text-blue-800"
          >
            Download file
          </a>
        )}
        <div className="max-h-80 overflow-auto rounded border border-slate-200 bg-slate-50 p-3">
          {job.result != null ? (
            <pre className="whitespace-pre-wrap text-xs text-slate-700">
              {JSON.stringify(job.result, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">No result payload available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  // Form state
  const [reportType, setReportType] = React.useState<
    "leads_summary" | "bookings_summary" | "revenue_summary"
  >("leads_summary");
  const [format, setFormat] = React.useState<"csv" | "json">("csv");
  const [formError, setFormError] = React.useState<string | null>(null);

  // Modal state
  const [previewJob, setPreviewJob] = React.useState<ReportJob | null>(null);

  const jobsQuery = useReportJobs();
  const queueMutation = useQueueReportMutation();
  const runMutation = useRunReportMutation();

  const jobs = jobsQuery.data?.jobs ?? [];

  // Auto-refresh: if any job is queued/running, refetchInterval is already
  // handled by the hook; we just show an indicator.
  const hasActiveJobs = jobs.some(
    (j) => j.status === "queued" || j.status === "running" || j.status === "processing",
  );

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = GenerateReportRequestSchema.safeParse({ reportType, format });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Validation error");
      return;
    }

    try {
      await queueMutation.mutateAsync(parsed.data);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to queue report");
    }
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        {hasActiveJobs && (
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            Refreshing automatically
          </span>
        )}
      </div>

      {/* Generate report form */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          Generate Report
        </h2>
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="report-type"
              className="text-xs font-medium text-slate-600"
            >
              Report Type
            </label>
            <select
              id="report-type"
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as
                    | "leads_summary"
                    | "bookings_summary"
                    | "revenue_summary",
                )
              }
              className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {REPORT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="report-format"
              className="text-xs font-medium text-slate-600"
            >
              Format
            </label>
            <select
              id="report-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "csv" | "json")}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {REPORT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={queueMutation.isPending}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {queueMutation.isPending ? "Queuing…" : "Generate Report"}
          </button>
        </form>

        {formError && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {formError}
          </p>
        )}
        {queueMutation.isSuccess && (
          <p className="mt-2 text-xs text-green-700">
            Report queued successfully.
          </p>
        )}
      </section>

      {/* Jobs table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Recent Report Jobs
        </h2>

        {jobsQuery.isError && (
          <ErrorBanner
            message={jobsQuery.error?.message ?? "Failed to load report jobs"}
            onRetry={() => void jobsQuery.refetch()}
          />
        )}

        {jobsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            No report jobs yet. Generate your first report above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Job ID</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Format</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {jobs.map((job) => (
                  <tr key={job.jobId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {job.jobId}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700">
                      {job.reportType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 uppercase text-slate-700">
                      {job.format}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {job.status === "completed" && (
                          <button
                            type="button"
                            onClick={() => setPreviewJob(job)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            View Result
                          </button>
                        )}
                        {job.status === "queued" && (
                          <button
                            type="button"
                            disabled={runMutation.isPending}
                            onClick={() => void runMutation.mutate(job.jobId)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {runMutation.isPending ? "Running…" : "Run Now"}
                          </button>
                        )}
                        {job.status === "failed" && job.errorMessage && (
                          <span
                            className="max-w-xs truncate text-xs text-red-600"
                            title={job.errorMessage}
                          >
                            {job.errorMessage}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Result preview modal */}
      {previewJob && (
        <ResultModal job={previewJob} onClose={() => setPreviewJob(null)} />
      )}
    </div>
  );
}
