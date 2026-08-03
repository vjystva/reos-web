"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { LEAD_STAGES, type Lead, type LeadStage } from "@/types/api";
import { stageLabel, formatDate } from "@/lib/utils";
import { leadStageTone } from "@/lib/leadTone";
import type { StatusTone } from "@/components/StatusPill";

interface LeadKanbanProps {
  leads: Lead[];
  isLoading?: boolean;
}

/**
 * Column accent rail — the stage tone (see `@/lib/leadTone`) rendered as a
 * 2px bar across the top of each column so the board reads as a progression
 * at a glance without adding another chip.
 */
const RAIL: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/30",
  info: "bg-chart-2",
  warn: "bg-accent",
  good: "bg-chart-4",
  bad: "bg-destructive",
};

export function LeadKanban({ leads, isLoading }: LeadKanbanProps) {
  const router = useRouter();
  const params = useSearchParams();

  function openLead(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("leadId", id);
    // Navigate to pipeline so the slide-over is mounted there.
    router.push(`/dashboard/pipeline?${next.toString()}`);
  }

  const grouped: Record<LeadStage, Lead[]> = {
    new: [],
    contacted: [],
    site_visit_scheduled: [],
    site_visit_done: [],
    negotiation: [],
    booking: [],
    lost: [],
  };
  for (const lead of leads) {
    grouped[lead.stage]?.push(lead);
  }

  return (
    <div
      role="region"
      aria-label="Lead pipeline"
      className="flex gap-2 overflow-x-auto pb-2"
    >
      {LEAD_STAGES.map((stage) => {
        const items = grouped[stage];
        return (
          <section
            key={stage}
            role="group"
            aria-label={`${stageLabel(stage)} — ${items.length} leads`}
            className="flex w-60 shrink-0 flex-col overflow-hidden rounded-md border border-border bg-muted/40"
          >
            <div className={`h-0.5 shrink-0 ${RAIL[leadStageTone(stage)]}`} aria-hidden="true" />
            <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-2.5 py-1.5">
              <h3 className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stageLabel(stage)}
              </h3>
              <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                {items.length}
              </span>
            </header>
            <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto p-1.5">
              {isLoading && items.length === 0 ? (
                <>
                  <Skeleton className="h-14 w-full rounded-sm" />
                  <Skeleton className="h-14 w-full rounded-sm" />
                </>
              ) : items.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-muted-foreground">
                  No leads
                </p>
              ) : (
                items.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => openLead(lead.id)}
                    className="flex flex-col gap-1.5 rounded-sm border border-border bg-card p-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">
                        {lead.name}
                      </span>
                      <span
                        className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-foreground"
                        title="AI score"
                      >
                        {lead.aiScore ?? "—"}
                      </span>
                    </div>
                    {lead.phone ? (
                      <span className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
                        {lead.phone}
                      </span>
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      <TemperatureBadge temperature={lead.temperature} />
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDate(lead.createdAt)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
