"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useLead } from "@/hooks/useLead";
import { stageLabel, formatDate } from "@/lib/utils";

export function LeadSlideOver() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const leadId = params.get("leadId");
  const open = Boolean(leadId);

  const { data: lead, isLoading, isError, error } = useLead(leadId);

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("leadId");
    router.push(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        aria-label={lead ? `Lead detail — ${lead.name}` : "Lead detail — loading"}
      >
        <SheetHeader>
          {isLoading ? (
            <>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </>
          ) : isError ? (
            <SheetTitle>Lead detail</SheetTitle>
          ) : lead ? (
            <>
              <SheetTitle>{lead.name}</SheetTitle>
              <SheetDescription>
                <span className="inline-flex items-center gap-2">
                  <TemperatureBadge temperature={lead.temperature} />
                  <Badge variant="secondary">Score: {lead.aiScore ?? "—"}</Badge>
                </span>
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
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-5 overflow-y-auto pt-2">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contact
              </h4>
              <dl className="mt-1 space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="w-16 text-slate-500">Phone</dt>
                  <dd className="text-slate-900">{lead.phone ?? "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 text-slate-500">Email</dt>
                  <dd className="text-slate-900">{lead.email ?? "—"}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stage
              </h4>
              <Badge variant="outline" className="mt-1">
                {stageLabel(lead.stage)}
              </Badge>
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Dealer
              </h4>
              <p className="mt-1 text-sm text-slate-900">
                {lead.assignedDealer?.name ?? "—"}
              </p>
            </section>

            {lead.scoreBreakdown ? (
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Score breakdown
                </h4>
                <dl className="mt-1 space-y-0.5 text-sm">
                  {Object.entries(lead.scoreBreakdown).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-slate-600">{k}</dt>
                      <dd className="font-medium text-slate-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {lead.activity && lead.activity.length > 0 ? (
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Activity
                </h4>
                <ol className="mt-1 space-y-2 text-sm">
                  {lead.activity.map((a, i) => (
                    <li key={a.id ?? i} className="border-l-2 border-slate-200 pl-3">
                      <time
                        dateTime={a.occurredAt}
                        className="block text-xs text-slate-500"
                      >
                        {formatDate(a.occurredAt)}
                      </time>
                      <p className="text-slate-900">
                        {a.description ?? a.type}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Created
              </h4>
              <p className="mt-1 text-sm text-slate-900">
                {formatDate(lead.createdAt)}
              </p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
