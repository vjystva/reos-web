import * as React from "react";
import type { LeadStage } from "@/types/api";

const stageColors: Record<LeadStage, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  site_visit_scheduled: "bg-amber-100 text-amber-700",
  site_visit_done: "bg-amber-200 text-amber-800",
  negotiation: "bg-orange-100 text-orange-700",
  booking: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

const stageLabels: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  site_visit_scheduled: "Site Visit",
  site_visit_done: "Visit Done",
  negotiation: "Negotiation",
  booking: "Booking",
  lost: "Lost",
};

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stageColors[stage]}`}>
      {stageLabels[stage]}
    </span>
  );
}
