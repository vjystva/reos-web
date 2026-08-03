"use client";

import * as React from "react";
import { LEAD_STAGES, type LeadStage } from "@/types/api";
import { cn, stageLabel } from "@/lib/utils";

interface LeadStageStepperProps {
  stage: LeadStage;
  /**
   * Optional stage-change handler. When omitted the stepper is read-only.
   * There is deliberately no stage add/rename/reorder UI here — the pipeline
   * is the fixed 7-stage enum from `LEAD_STAGES`.
   */
  onSelect?: (stage: LeadStage) => void;
  disabled?: boolean;
  className?: string;
}

type StepState = "past" | "current" | "future";

/**
 * Pipeline stage stepper.
 *
 *   past    → primary tint      (navy, completed)
 *   current → accent tint, bold (amber — the signature accent)
 *   future  → muted
 *
 * `lost` is an outcome rather than a step, so when a lead is lost nothing on
 * the win path is shown as completed: every other step renders `future` and
 * the `lost` step renders in the destructive tint.
 */
export function LeadStageStepper({
  stage,
  onSelect,
  disabled,
  className,
}: LeadStageStepperProps) {
  const currentIndex = LEAD_STAGES.indexOf(stage);
  const isLost = stage === "lost";

  function stateOf(index: number, s: LeadStage): StepState {
    if (s === stage) return "current";
    if (isLost) return "future";
    return index < currentIndex ? "past" : "future";
  }

  const interactive = Boolean(onSelect) && !disabled;

  return (
    <ol
      aria-label="Pipeline stage"
      className={cn("flex items-stretch gap-1 overflow-x-auto pb-1", className)}
    >
      {LEAD_STAGES.map((s, i) => {
        const state = stateOf(i, s);
        const isCurrent = state === "current";
        const lostStep = s === "lost";

        const tint =
          state === "past"
            ? "border-primary/25 bg-primary/10 text-primary"
            : isCurrent
              ? lostStep
                ? "border-destructive/40 bg-destructive/15 text-destructive font-semibold"
                : "border-accent/40 bg-accent/20 text-accent-foreground font-semibold"
              : "border-border bg-muted text-muted-foreground";

        const badgeTint =
          state === "past"
            ? "border-primary/30 bg-primary/15 text-primary"
            : isCurrent
              ? lostStep
                ? "border-destructive/40 bg-destructive/20 text-destructive"
                : "border-accent/50 bg-accent/30 text-accent-foreground"
              : "border-border bg-card text-muted-foreground";

        const content = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] leading-none tabular-nums",
                badgeTint,
              )}
            >
              {i + 1}
            </span>
            <span className="whitespace-nowrap">{stageLabel(s)}</span>
          </>
        );

        const shared = cn(
          "flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] uppercase tracking-wider transition-colors",
          tint,
        );

        return (
          <li key={s} className="shrink-0" aria-current={isCurrent ? "step" : undefined}>
            {interactive ? (
              <button
                type="button"
                onClick={() => onSelect?.(s)}
                aria-label={`Move lead to ${stageLabel(s)}`}
                className={cn(
                  shared,
                  "hover:border-accent/50 hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                )}
              >
                {content}
              </button>
            ) : (
              <span className={cn(shared, disabled && "opacity-80")}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
