"use client";
import * as React from "react";
import { LEAD_STAGES, type LeadStage } from "@/types/api";

interface LeadStageSelectProps {
  value: LeadStage;
  onChange: (stage: LeadStage) => void;
  disabled?: boolean;
}

const stageLabels: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  site_visit_scheduled: "Site Visit Scheduled",
  site_visit_done: "Site Visit Done",
  negotiation: "Negotiation",
  booking: "Booking",
  lost: "Lost",
};

export function LeadStageSelect({ value, onChange, disabled }: LeadStageSelectProps) {
  return (
    <select
      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-50"
      value={value}
      onChange={(e) => onChange(e.target.value as LeadStage)}
      disabled={disabled}
    >
      {LEAD_STAGES.map((s) => (
        <option key={s} value={s}>{stageLabels[s]}</option>
      ))}
    </select>
  );
}
