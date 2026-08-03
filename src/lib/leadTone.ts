import type { StatusTone } from "@/components/StatusPill";
import { LEAD_STAGES, type LeadStage, type LeadTemperature } from "@/types/api";

/**
 * Lead visual conventions — single source of truth shared by the pipeline
 * board, the lead table, the slide-over and the lead detail page so every
 * surface reads the same colour language.
 *
 * ── Stage → StatusPill tone ────────────────────────────────────────────────
 * Progression: neutral (no signal yet) → info (in flight) → warn (closing
 * push, needs attention) → good / bad (terminal).
 *
 *   new                  → neutral
 *   contacted            → info
 *   site_visit_scheduled → info
 *   site_visit_done      → info
 *   negotiation          → warn
 *   booking              → good
 *   lost                 → bad
 *
 * ── Temperature ────────────────────────────────────────────────────────────
 * Temperature is a heat scale, not a health scale, so force-fitting it onto
 * the five StatusPill tones reads wrong (a "hot" lead is good news, but would
 * land on `bad`/red). It gets its own chip palette instead, built from the
 * same border/10-bg/border-30 recipe as StatusPill so the two sit together
 * without clashing:
 *
 *   hot  → chart-5 (red)    — act now
 *   warm → chart-3 (amber)  — the signature accent hue
 *   cold → muted            — no heat, no colour
 */

export const LEAD_STAGE_TONE: Record<LeadStage, StatusTone> = {
  new: "neutral",
  contacted: "info",
  site_visit_scheduled: "info",
  site_visit_done: "info",
  negotiation: "warn",
  booking: "good",
  lost: "bad",
};

export function leadStageTone(stage: LeadStage | string): StatusTone {
  return LEAD_STAGE_TONE[stage as LeadStage] ?? "neutral";
}

/** Terminal stages — no further progression is possible. */
export const TERMINAL_LEAD_STAGES: LeadStage[] = ["booking", "lost"];

export function isTerminalLeadStage(stage: LeadStage): boolean {
  return TERMINAL_LEAD_STAGES.includes(stage);
}

/**
 * The next stage in the fixed pipeline, or `null` at a terminal stage.
 * `lost` is never suggested as a "next action" — it is an outcome, not a step.
 */
export function nextLeadStage(stage: LeadStage): LeadStage | null {
  if (isTerminalLeadStage(stage)) return null;
  const i = LEAD_STAGES.indexOf(stage);
  const next = i >= 0 ? LEAD_STAGES[i + 1] : undefined;
  if (!next || next === "lost") return null;
  return next;
}

export const LEAD_TEMPERATURE_LABEL: Record<LeadTemperature, string> = {
  hot: "HOT",
  warm: "WARM",
  cold: "COLD",
};

/** Chip classes — same shape recipe as StatusPill, heat-scale palette. */
export const LEAD_TEMPERATURE_CLASS: Record<LeadTemperature, string> = {
  hot: "border-chart-5/30 bg-chart-5/10 text-chart-5",
  warm: "border-chart-3/40 bg-chart-3/15 text-accent-foreground",
  cold: "border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground",
};

/** Solid dot / bar fill for the same heat scale (kanban rails, legends). */
export const LEAD_TEMPERATURE_DOT: Record<LeadTemperature, string> = {
  hot: "bg-chart-5",
  warm: "bg-chart-3",
  cold: "bg-muted-foreground/40",
};

/**
 * Activity-timeline dot colour. Known activity types get a stable hue;
 * anything else is hashed across chart-1..5 so an unseen type still gets a
 * consistent (and distinguishable) colour rather than falling flat to grey.
 */
const ACTIVITY_DOT: Record<string, string> = {
  created: "bg-chart-1",
  call: "bg-chart-1",
  phone: "bg-chart-1",
  email: "bg-chart-2",
  sms: "bg-chart-2",
  message: "bg-chart-2",
  note: "bg-chart-3",
  stage_change: "bg-chart-3",
  follow_up: "bg-chart-3",
  whatsapp: "bg-chart-4",
  site_visit: "bg-chart-4",
  visit: "bg-chart-4",
  booking: "bg-chart-4",
  lost: "bg-chart-5",
  cancelled: "bg-chart-5",
};

const ACTIVITY_PALETTE = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

export function activityDotClass(type: string | null | undefined): string {
  if (!type) return "bg-muted-foreground/40";
  const key = type.toLowerCase();
  const known = ACTIVITY_DOT[key];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 9973;
  }
  return ACTIVITY_PALETTE[hash % ACTIVITY_PALETTE.length];
}

/** Humanise an activity type ("stage_change" → "Stage change"). */
export function activityLabel(type: string): string {
  const s = type.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : type;
}
