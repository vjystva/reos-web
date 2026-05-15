"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { Badge } from "@/components/ui/badge";
import { LEAD_STAGES, type Lead, type LeadStage } from "@/types/api";
import { stageLabel } from "@/lib/utils";

interface LeadKanbanProps {
  leads: Lead[];
  isLoading?: boolean;
}

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
      className="flex gap-3 overflow-x-auto pb-2"
    >
      {LEAD_STAGES.map((stage) => {
        const items = grouped[stage];
        return (
          <section
            key={stage}
            role="group"
            aria-label={`${stageLabel(stage)} — ${items.length} leads`}
            className="flex w-64 shrink-0 flex-col rounded-md border border-slate-200 bg-slate-50"
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-700">
                {stageLabel(stage)}
              </h3>
              <Badge variant="outline">{items.length}</Badge>
            </header>
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
              {isLoading && items.length === 0 ? (
                <div className="h-12 animate-pulse rounded bg-slate-200" />
              ) : items.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  No leads
                </div>
              ) : (
                items.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => openLead(lead.id)}
                    className="flex flex-col gap-1 rounded border border-slate-200 bg-white p-2 text-left text-sm shadow-sm hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-900">
                        {lead.name}
                      </span>
                      <Badge variant="secondary">{lead.aiScore ?? "—"}</Badge>
                    </div>
                    <TemperatureBadge temperature={lead.temperature} />
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
