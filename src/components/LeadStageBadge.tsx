import * as React from "react";
import { StatusPill } from "@/components/StatusPill";
import { leadStageTone } from "@/lib/leadTone";
import type { LeadStage } from "@/types/api";

/**
 * Short-form stage labels for chips in dense rows/cards. The long-form labels
 * (`stageLabel()` in `@/lib/utils`) are used for selects and the stepper.
 */
const stageLabels: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  site_visit_scheduled: "Site Visit",
  site_visit_done: "Visit Done",
  negotiation: "Negotiation",
  booking: "Booking",
  lost: "Lost",
};

/** Stage chip. Tone mapping lives in `@/lib/leadTone` (`LEAD_STAGE_TONE`). */
export function LeadStageBadge({
  stage,
  className,
}: {
  stage: LeadStage;
  className?: string;
}) {
  return (
    <StatusPill tone={leadStageTone(stage)} className={className}>
      {stageLabels[stage] ?? stage}
    </StatusPill>
  );
}
