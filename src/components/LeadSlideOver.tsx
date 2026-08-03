"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { LeadStageBadge } from "@/components/LeadStageBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useLead } from "@/hooks/useLead";
import { useQueryClient } from "@tanstack/react-query";
import { stageLabel, formatDate } from "@/lib/utils";
import { activityDotClass, activityLabel, nextLeadStage } from "@/lib/leadTone";

const SECTION = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

export function LeadSlideOver() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [rescoring, setRescoring] = React.useState(false);
  const [rescoreMsg, setRescoreMsg] = React.useState<string | null>(null);

  const leadId = params.get("leadId");
  const open = Boolean(leadId);

  const { data: lead, isLoading, isError, error } = useLead(leadId ?? "");

  async function handleRescore() {
    if (!leadId) return;
    setRescoring(true);
    setRescoreMsg(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/rescore`, { method: "POST" });
      if (res.ok) {
        await qc.invalidateQueries({ queryKey: ["lead", leadId] });
        await qc.invalidateQueries({ queryKey: ["leads"] });
        setRescoreMsg("Score updated successfully.");
      } else {
        const err = await res.json().catch(() => ({ error: "unknown" })) as { error?: string };
        setRescoreMsg(`Failed: ${err.error ?? "unknown error"}`);
      }
    } catch { setRescoreMsg("Network error."); }
    finally { setRescoring(false); }
  }

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("leadId");
    router.push(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }

  const activity = lead?.activity ?? [];
  const next = lead ? nextLeadStage(lead.stage) : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        aria-label={lead ? `Lead detail — ${lead.name}` : "Lead detail — loading"}
      >
        <SheetHeader>
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </>
          ) : isError ? (
            <SheetTitle>Lead detail</SheetTitle>
          ) : lead ? (
            <>
              <SheetTitle>{lead.name}</SheetTitle>
              <SheetDescription asChild>
                <div>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <TemperatureBadge temperature={lead.temperature} />
                    <LeadStageBadge stage={lead.stage} />
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      score {lead.aiScore ?? "—"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRescore}
                      disabled={rescoring}
                      className="h-6 px-2 text-[11px]"
                    >
                      {rescoring ? "Rescoring…" : "Rescore AI"}
                    </Button>
                  </span>
                  {rescoreMsg && (
                    <span
                      className={`mt-1 block text-[11px] ${
                        rescoreMsg.startsWith("Score") ? "text-chart-4" : "text-destructive"
                      }`}
                    >
                      {rescoreMsg}
                    </span>
                  )}
                </div>
              </SheetDescription>
            </>
          ) : null}
        </SheetHeader>

        {isError ? (
          <ErrorBanner
            message={
              error instanceof Error && error.message === "not_found"
                ? "Lead not found."
                : "Failed to load lead detail."
            }
            onRetry={close}
            retryLabel="Close"
          />
        ) : isLoading || !lead ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pt-1">
            <section>
              <h4 className={SECTION}>Contact</h4>
              <dl className="mt-1.5 space-y-1">
                <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Phone
                  </dt>
                  <dd className="font-mono text-xs tabular-nums text-foreground">
                    {lead.phone ?? "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Email
                  </dt>
                  <dd className="truncate text-xs text-foreground">{lead.email ?? "—"}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Source
                  </dt>
                  <dd className="text-xs text-foreground">{lead.source ?? "—"}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Dealer
                  </dt>
                  <dd className="text-xs text-foreground">
                    {lead.assignedDealer?.name ?? "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Created
                  </dt>
                  <dd className="font-mono text-xs tabular-nums text-foreground">
                    {formatDate(lead.createdAt)}
                  </dd>
                </div>
              </dl>
            </section>

            {lead.scoreBreakdown && Object.keys(lead.scoreBreakdown).length > 0 ? (
              <section>
                <h4 className={SECTION}>Score breakdown</h4>
                <dl className="mt-1.5 space-y-1">
                  {Object.entries(lead.scoreBreakdown).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">{activityLabel(k)}</dt>
                      <dd className="font-mono text-xs font-semibold tabular-nums text-foreground">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {activity.length > 0 ? (
              <section>
                <h4 className={SECTION}>Activity</h4>
                <ol className="mt-1.5 space-y-2.5">
                  {activity.map((a, i) => (
                    <li key={a.id ?? i} className="flex gap-2.5">
                      <span className="relative flex flex-col items-center">
                        <span
                          aria-hidden="true"
                          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${activityDotClass(a.type)}`}
                        />
                        {i < activity.length - 1 ? (
                          <span aria-hidden="true" className="mt-0.5 w-px flex-1 bg-border" />
                        ) : null}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-foreground">
                          {a.description ?? activityLabel(a.type)}
                        </p>
                        <time
                          dateTime={a.occurredAt}
                          className="mt-0.5 block font-mono text-[11px] tabular-nums text-muted-foreground"
                        >
                          {formatDate(a.occurredAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {/* Next action — read-only here; the full detail page owns stage moves. */}
            {next ? (
              <div className="rounded-sm border border-accent/30 bg-accent/10 p-2.5">
                <p className={SECTION}>Next action</p>
                <p className="mt-1 text-xs font-medium text-foreground">
                  Move this lead to {stageLabel(next)}
                </p>
              </div>
            ) : null}

            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/dashboard/leads/${lead.id}`}>Open full detail</Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
