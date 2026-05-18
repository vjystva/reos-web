"use client";
import * as React from "react";
import { z } from "zod";
import { REPORT_TYPES, type ReportType, type GenerateReportRequest } from "@/types/api";
import { ReportTypeSelect } from "@/components/ReportTypeSelect";
import { useGenerateReportMutation } from "@/hooks/useGenerateReportMutation";

const schema = z.object({
  reportType: z.enum(["leads", "bookings", "payments", "site_visits"] as [ReportType, ...ReportType[]]),
  format: z.enum(["csv", "json"]),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  projectId: z.string().optional(),
}).refine((d) => {
  if (d.dateFrom && d.dateTo && d.dateTo < d.dateFrom) return false;
  return true;
}, { message: "Date To cannot be before Date From", path: ["dateTo"] });

interface GenerateReportFormProps { onSuccess?: () => void; }

export function GenerateReportForm({ onSuccess }: GenerateReportFormProps) {
  const [form, setForm] = React.useState<GenerateReportRequest>({ reportType: "leads", format: "csv" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const mutation = useGenerateReportMutation();

  const set = (k: keyof GenerateReportRequest, v: string) => setForm((f) => ({ ...f, [k]: v || undefined }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.issues.forEach((i) => { if (i.path[0]) fe[String(i.path[0])] = i.message; });
      setErrors(fe);
      return;
    }
    setErrors({});
    await mutation.mutateAsync(result.data);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Report Type</label>
        <ReportTypeSelect value={form.reportType} onChange={(v) => set("reportType", v)} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Format</label>
        <select className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm" value={form.format} onChange={(e) => set("format", e.target.value)}>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date From</label>
          <input type="date" className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.dateFrom ?? ""} onChange={(e) => set("dateFrom", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date To</label>
          <input type="date" className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.dateTo ?? ""} onChange={(e) => set("dateTo", e.target.value)} />
          {errors.dateTo && <p className="mt-1 text-xs text-red-600">{errors.dateTo}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Project ID (optional)</label>
        <input type="text" className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Filter by project ID" value={form.projectId ?? ""} onChange={(e) => set("projectId", e.target.value)} />
      </div>
      <button type="submit" disabled={mutation.isPending} className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {mutation.isPending ? "Generating…" : "Generate Report"}
      </button>
    </form>
  );
}
