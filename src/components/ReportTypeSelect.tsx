"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { REPORT_TYPES, type ReportType } from "@/types/api";

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  leads: "Leads",
  bookings: "Bookings",
  payments: "Payments",
  site_visits: "Site Visits",
};

interface ReportTypeSelectProps {
  id?: string;
  value: ReportType;
  onChange: (value: ReportType) => void;
  disabled?: boolean;
  className?: string;
}

export function ReportTypeSelect({
  id,
  value,
  onChange,
  disabled,
  className,
}: ReportTypeSelectProps) {
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as ReportType)}
      disabled={disabled}
      className={className}
      aria-label="Report type"
    >
      {REPORT_TYPES.map((t) => (
        <option key={t} value={t}>
          {REPORT_TYPE_LABELS[t]}
        </option>
      ))}
    </Select>
  );
}
