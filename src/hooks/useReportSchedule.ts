"use client";

import { z } from "zod";

export const ScheduleFrequencySchema = z.enum(["daily", "weekly", "monthly"]);
export type ScheduleFrequency = z.infer<typeof ScheduleFrequencySchema>;

export const ReportTypeSchema = z.enum(["bookings", "payments", "leads", "analytics"]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ScheduleFormSchema = z.object({
  reportType: ReportTypeSchema,
  frequency: ScheduleFrequencySchema,
  email: z.string().email("Invalid email address"),
  label: z.string().min(1, "Label is required").max(100, "Label too long"),
});
export type ScheduleForm = z.infer<typeof ScheduleFormSchema>;

export function frequencyLabel(f: string): string {
  const map: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
  return map[f] ?? f;
}

export function reportTypeLabel(t: string): string {
  const map: Record<string, string> = {
    bookings: "Bookings Report",
    payments: "Payments Report",
    leads: "Leads Report",
    analytics: "Analytics Report",
  };
  return map[t] ?? t;
}

export function nextRunLabel(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case "daily": {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(6, 0, 0, 0);
      return `Tomorrow at 06:00 (${next.toLocaleDateString()})`;
    }
    case "weekly": {
      const next = new Date(now);
      const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
      next.setDate(next.getDate() + daysUntilMonday);
      next.setHours(6, 0, 0, 0);
      return `Next Monday (${next.toLocaleDateString()})`;
    }
    case "monthly": {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 6, 0, 0, 0);
      return `1st of next month (${next.toLocaleDateString()})`;
    }
    default:
      return "Unknown";
  }
}

export function validateScheduleForm(form: unknown): { success: true; data: ScheduleForm } | { success: false; error: string } {
  const result = ScheduleFormSchema.safeParse(form);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Validation failed" };
  }
  return { success: true, data: result.data };
}
