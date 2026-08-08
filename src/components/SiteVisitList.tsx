"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/SkeletonCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SiteVisitStatusBadge } from "@/components/SiteVisitStatusBadge";
import type { SiteVisit } from "@/types/api";

interface SiteVisitListProps {
  visits: SiteVisit[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  onConfirm: (visit: SiteVisit) => void;
  onReschedule: (visit: SiteVisit) => void;
  onCancel: (visit: SiteVisit) => void;
  onComplete: (visit: SiteVisit) => void;
  confirmingId?: string | null;
  completingId?: string | null;
}

function formatVisitDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SiteVisitList({
  visits,
  isLoading,
  isError,
  onRetry,
  onConfirm,
  onReschedule,
  onCancel,
  onComplete,
  confirmingId,
  completingId,
}: SiteVisitListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner
        message="Failed to load site visits."
        onRetry={onRetry}
      />
    );
  }

  if (!visits || visits.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No site visits scheduled for this booking yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3" role="list">
      {visits.map((v) => {
        // Mirrors backend `ALLOWED_VISIT_TRANSITIONS`:
        //   scheduled -> confirmed | cancelled
        //   confirmed -> completed | cancelled (| scheduled, via reschedule)
        //   completed / cancelled are terminal
        const canConfirm = v.status === "scheduled";
        const canReschedule = v.status === "scheduled" || v.status === "confirmed";
        const canCancel = v.status === "scheduled" || v.status === "confirmed";
        const canComplete = v.status === "confirmed";

        return (
          <li
            key={v.id}
            data-testid="site-visit-row"
            data-visit-id={v.id}
            data-visit-status={v.status}
            className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {formatVisitDate(v.visitDate)}
                </span>
                <SiteVisitStatusBadge status={v.status} />
              </div>
              {v.notes ? (
                <p className="text-xs text-slate-600">{v.notes}</p>
              ) : null}
              {v.assignedAgentId ? (
                <p className="text-xs text-slate-500">
                  Agent: <span className="font-mono">{v.assignedAgentId}</span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canConfirm ? (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onConfirm(v)}
                  disabled={confirmingId === v.id}
                >
                  {confirmingId === v.id ? "Confirming…" : "Confirm"}
                </Button>
              ) : null}
              {canComplete ? (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onComplete(v)}
                  disabled={completingId === v.id}
                >
                  {completingId === v.id ? "Completing…" : "Mark completed"}
                </Button>
              ) : null}
              {canReschedule ? (
                <Button size="sm" variant="outline" onClick={() => onReschedule(v)}>
                  Reschedule
                </Button>
              ) : null}
              {canCancel ? (
                <Button size="sm" variant="destructive" onClick={() => onCancel(v)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
