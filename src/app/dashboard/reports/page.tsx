"use client";
import * as React from "react";
import { GenerateReportForm } from "@/components/GenerateReportForm";
import { ReportJobsList } from "@/components/ReportJobsList";

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Reports &amp; Exports</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Generate Report</h2>
          <GenerateReportForm />
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-700">Recent Reports</h2>
            <span className="text-xs text-slate-400">Auto-refreshing every 15s</span>
          </div>
          <ReportJobsList />
        </div>
      </div>
    </div>
  );
}
