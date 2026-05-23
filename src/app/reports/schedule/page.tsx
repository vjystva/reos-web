"use client";

import React, { useState } from "react";
import {
  validateScheduleForm,
  frequencyLabel,
  reportTypeLabel,
  nextRunLabel,
  type ScheduleFrequency,
  type ReportType,
} from "@/hooks/useReportSchedule";

interface FormState {
  reportType: string;
  frequency: string;
  email: string;
  label: string;
}

const EMPTY: FormState = { reportType: "", frequency: "", email: "", label: "" };

export default function ReportSchedulePage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handle(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateScheduleForm(form);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800 font-semibold">Schedule created!</p>
          <p className="text-sm text-green-700 mt-1">
            {reportTypeLabel(form.reportType)} will be sent {frequencyLabel(form.frequency).toLowerCase()} to {form.email}.
          </p>
          <p className="text-xs text-green-600 mt-2">Next run: {nextRunLabel(form.frequency)}</p>
          <button
            className="mt-4 px-4 py-2 bg-green-700 text-white rounded text-sm"
            onClick={() => { setSuccess(false); setForm(EMPTY); }}
          >
            Schedule another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Schedule a Report</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
          <select
            value={form.reportType}
            onChange={(e) => handle("reportType", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Select a report…</option>
            {(["bookings", "payments", "leads", "analytics"] as ReportType[]).map((t) => (
              <option key={t} value={t}>{reportTypeLabel(t)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
          <select
            value={form.frequency}
            onChange={(e) => handle("frequency", e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Select frequency…</option>
            {(["daily", "weekly", "monthly"] as ScheduleFrequency[]).map((f) => (
              <option key={f} value={f}>{frequencyLabel(f)}</option>
            ))}
          </select>
          {form.frequency && (
            <p className="text-xs text-gray-500 mt-1">Next run: {nextRunLabel(form.frequency)}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handle("email", e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => handle("label", e.target.value)}
            placeholder="e.g. Weekly Sales Summary"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Schedule Report
        </button>
      </form>
    </div>
  );
}
