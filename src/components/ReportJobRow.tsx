"use client";
import * as React from "react";
import type { ReportJob, ReportType, ReportJobStatus } from "@/types/api";

const typeColors: Record<ReportType, string> = {
  leads: "bg-blue-100 text-blue-700",
  bookings: "bg-green-100 text-green-700",
  payments: "bg-purple-100 text-purple-700",
  site_visits: "bg-amber-100 text-amber-700",
  leads_summary: "bg-blue-100 text-blue-600",
  bookings_summary: "bg-green-100 text-green-600",
  revenue_summary: "bg-purple-100 text-purple-600",
  project_wise_sales: "bg-teal-100 text-teal-700",
  sales_performance: "bg-indigo-100 text-indigo-700",
  agent_commission: "bg-orange-100 text-orange-700",
  collection_report: "bg-rose-100 text-rose-700",
};
const statusColors: Record<ReportJobStatus, string> = {
  queued: "bg-slate-100 text-slate-600",
  running: "bg-blue-100 text-blue-700",
  processing: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export function ReportJobRow({ job }: { job: ReportJob }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[job.reportType]}`}>{job.reportType}</span>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[job.status]}`}>{job.status === "processing" ? "⟳ Processing" : job.status}</span>
        {job.rowCount != null && <span className="text-xs text-slate-500">{job.rowCount} rows</span>}
        <span className="text-xs text-slate-400 truncate">{new Date(job.createdAt).toLocaleString("en-IN")}</span>
      </div>
      {job.status === "completed" && job.downloadUrl && (
        <a href={job.downloadUrl} target="_blank" rel="noopener noreferrer" className="ml-3 shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700">Download</a>
      )}
    </div>
  );
}
