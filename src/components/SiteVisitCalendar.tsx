"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type StatusTone } from "@/components/StatusPill";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  dayKey,
  groupByDay,
  isSameDay,
  monthLabel,
  timeLabel,
} from "@/lib/siteVisitCalendar";
import type { SiteVisitStatus, TenantSiteVisit } from "@/types/api";

/* -------------------------------------------------------------------------
 * Status → tone
 * ---------------------------------------------------------------------- */

/**
 * Four visually distinct tones — on a dense month grid the dot colour is the
 * primary signal, so `confirmed` takes amber rather than sharing green with
 * `completed`. The legend under the grid spells the mapping out.
 */
export const VISIT_TONE: Record<SiteVisitStatus, StatusTone> = {
  scheduled: "info",
  confirmed: "warn",
  completed: "good",
  cancelled: "bad",
};

export const VISIT_DOT_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-chart-2",
  warn: "bg-accent",
  good: "bg-chart-4",
  bad: "bg-destructive",
};

const CHIP_CLASS: Record<StatusTone, string> = {
  neutral: "border-l-muted-foreground/60 hover:bg-muted-foreground/10",
  info: "border-l-chart-2 hover:bg-chart-2/10",
  warn: "border-l-accent hover:bg-accent/10",
  good: "border-l-chart-4 hover:bg-chart-4/10",
  bad: "border-l-destructive hover:bg-destructive/10",
};

export const VISIT_STATUS_LABEL: Record<SiteVisitStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

/* -------------------------------------------------------------------------
 * View model
 * ---------------------------------------------------------------------- */

/** A visit with the FK ids already resolved to display names by the page. */
export interface CalendarVisit {
  visit: TenantSiteVisit;
  /** Lead (or booking) display name — falls back to a short id. */
  leadName: string;
  projectName: string | null;
  ownerName: string | null;
}

/** Full context string used for the chip `title` tooltip and list rows. */
export function visitTooltip(v: CalendarVisit): string {
  const lines = [
    `${timeLabel(v.visit.scheduledAt)} · ${v.leadName}`,
    `Project: ${v.projectName ?? "—"}`,
    `Owner: ${v.ownerName ?? "Unassigned"}`,
    `Status: ${VISIT_STATUS_LABEL[v.visit.status]}`,
  ];
  if (v.visit.notes) lines.push(`Notes: ${v.visit.notes}`);
  if (v.visit.status === "cancelled" && v.visit.cancellationReason) {
    lines.push(`Reason: ${v.visit.cancellationReason}`);
  }
  return lines.join("\n");
}

/* -------------------------------------------------------------------------
 * Chip
 * ---------------------------------------------------------------------- */

function VisitChip({
  item,
  onSelect,
}: {
  item: CalendarVisit;
  onSelect?: (item: CalendarVisit) => void;
}) {
  const tone = VISIT_TONE[item.visit.status] ?? "neutral";
  return (
    <button
      type="button"
      title={visitTooltip(item)}
      onClick={onSelect ? () => onSelect(item) : undefined}
      className={cn(
        "flex w-full items-center gap-1 rounded-sm border-l-2 bg-muted/40 px-1 py-0.5 text-left text-[11px] leading-tight transition-colors",
        CHIP_CLASS[tone],
        item.visit.status === "cancelled" && "opacity-70",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          VISIT_DOT_CLASS[tone],
        )}
      />
      <span className="truncate font-medium text-foreground">
        {item.leadName}
      </span>
      {item.visit.notes ? (
        <span className="truncate text-muted-foreground">
          {item.visit.notes}
        </span>
      ) : null}
    </button>
  );
}

/* -------------------------------------------------------------------------
 * Grid
 * ---------------------------------------------------------------------- */

const CHIPS_PER_CELL = 3;

export interface SiteVisitCalendarProps {
  /** First-of-month date driving the visible grid. */
  anchor: Date;
  visits: CalendarVisit[];
  isLoading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect?: (item: CalendarVisit) => void;
  className?: string;
}

export function SiteVisitCalendar({
  anchor,
  visits,
  isLoading,
  onPrev,
  onNext,
  onToday,
  onSelect,
  className,
}: SiteVisitCalendarProps) {
  const cells = React.useMemo(() => buildMonthGrid(anchor), [anchor]);
  const byDay = React.useMemo(
    () => groupByDay(visits, (v) => v.visit.scheduledAt),
    [visits],
  );
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // Collapse any expanded cells when the month changes.
  React.useEffect(() => setExpanded(new Set()), [anchor]);

  const today = new Date();
  const anchorMonth = anchor.getMonth();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-card",
        className,
      )}
    >
      {/* Month nav */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {monthLabel(anchor)}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={onPrev}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={onNext}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Weekday header — Monday first */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/60">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* 42 cells, 6 rows */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const key = dayKey(date);
          const dayVisits = (byDay.get(key) ?? []).slice().sort(
            (a, b) =>
              new Date(a.visit.scheduledAt).getTime() -
              new Date(b.visit.scheduledAt).getTime(),
          );
          const outside = date.getMonth() !== anchorMonth;
          const isToday = isSameDay(date, today);
          const isOpen = expanded.has(key);
          const shown = isOpen ? dayVisits : dayVisits.slice(0, CHIPS_PER_CELL);
          const overflow = dayVisits.length - shown.length;

          return (
            <div
              key={key}
              className={cn(
                "min-h-[6.5rem] border-b border-r border-border p-1",
                i % 7 === 6 && "border-r-0",
                i >= 35 && "border-b-0",
                outside && "bg-muted/30",
              )}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={cn(
                    "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-sm px-1 font-mono text-[11px] tabular-nums",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : outside
                        ? "text-muted-foreground/60"
                        : "text-muted-foreground",
                  )}
                >
                  {date.getDate()}
                </span>
                {dayVisits.length > 0 ? (
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {dayVisits.length}
                  </span>
                ) : null}
              </div>

              {isLoading && i < 14 ? (
                <Skeleton className="h-4 w-full rounded-sm" />
              ) : (
                <div className="space-y-0.5">
                  {shown.map((item) => (
                    <VisitChip
                      key={item.visit.id}
                      item={item}
                      onSelect={onSelect}
                    />
                  ))}
                  {overflow > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          next.add(key);
                          return next;
                        })
                      }
                      className="w-full rounded-sm px-1 text-left text-[11px] font-medium text-primary hover:underline"
                    >
                      +{overflow} more
                    </button>
                  ) : null}
                  {isOpen && dayVisits.length > CHIPS_PER_CELL ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          next.delete(key);
                          return next;
                        })
                      }
                      className="w-full rounded-sm px-1 text-left text-[11px] font-medium text-muted-foreground hover:underline"
                    >
                      Show less
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-1.5">
        {(Object.keys(VISIT_TONE) as SiteVisitStatus[]).map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                VISIT_DOT_CLASS[VISIT_TONE[s]],
              )}
            />
            {VISIT_STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
