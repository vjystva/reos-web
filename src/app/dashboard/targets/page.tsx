"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PollIndicator } from "@/components/PollIndicator";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface SalesTarget {
  id: string;
  assigneeId: string;
  period: string;
  periodStart: string;
  targetBookings?: number;
  targetRevenue?: string | number;
  actualBookings?: number;
  actualRevenue?: string | number;
}

async function fetchTargets(params?: { assigneeId?: string; period?: string }): Promise<{ data: SalesTarget[] }> {
  const qs = new URLSearchParams();
  if (params?.assigneeId) qs.set("assigneeId", params.assigneeId);
  if (params?.period) qs.set("period", params.period);
  const res = await fetch(`/api/sales-targets${qs.toString() ? "?" + qs.toString() : ""}`);
  if (res.status === 401) { window.location.href = "/login"; throw new Error("unauthorized"); }
  if (!res.ok) throw new Error(`targets_fetch_failed_${res.status}`);
  const json = await res.json() as { data?: SalesTarget[] };
  return { data: json.data ?? [] };
}

async function createTarget(body: {
  assigneeId: string;
  period: string;
  periodStart: string;
  targetBookings?: number;
  targetRevenue?: number;
}): Promise<SalesTarget> {
  const res = await fetch("/api/sales-targets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" })) as { error?: string; message?: string };
    throw new Error(err.message ?? err.error ?? "Failed to create target");
  }
  return res.json() as Promise<SalesTarget>;
}

function pct(actual: number | string | undefined, target: number | string | undefined): number {
  const a = Number(actual ?? 0);
  const t = Number(target ?? 0);
  if (t === 0) return 0;
  return Math.min(100, Math.round((a / t) * 100));
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export default function TargetsPage() {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = React.useState("");

  const query = useQuery({
    queryKey: ["sales-targets", periodFilter],
    queryFn: () => fetchTargets(periodFilter ? { period: periodFilter } : undefined),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createTarget,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sales-targets"] });
      setSheetOpen(false);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const targets = query.data?.data ?? [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      assigneeId: fd.get("assigneeId") as string,
      period: fd.get("period") as string,
      periodStart: fd.get("periodStart") as string,
      targetBookings: fd.get("targetBookings") ? Number(fd.get("targetBookings")) : undefined,
      targetRevenue: fd.get("targetRevenue") ? Number(fd.get("targetRevenue")) : undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Sales Targets</h1>
          <p className="text-sm text-slate-500">Track team bookings and revenue targets vs actuals</p>
        </div>
        <div className="flex items-center gap-2">
          <PollIndicator isFetching={query.isFetching} isError={query.isError} dataUpdatedAt={query.dataUpdatedAt} onRetry={() => void query.refetch()} />
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            <option value="">All periods</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <Button size="sm" onClick={() => setSheetOpen(true)}>Set Target</Button>
        </div>
      </div>

      {query.isError && <ErrorBanner message={(query.error as Error).message} onRetry={() => void query.refetch()} />}

      {query.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}

      {!query.isLoading && targets.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">No targets set yet. Click &ldquo;Set Target&rdquo; to create one.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {targets.map((t) => {
          const bookingPct = pct(t.actualBookings, t.targetBookings);
          const revPct = pct(t.actualRevenue, t.targetRevenue);
          const overallPct = Math.round((bookingPct + revPct) / 2);
          const color = overallPct >= 80 ? "bg-green-500" : overallPct >= 50 ? "bg-amber-400" : "bg-red-400";
          return (
            <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 capitalize">{t.period} — {t.periodStart?.slice(0, 7)}</p>
                  <p className="text-sm font-medium text-slate-700 font-mono">{t.assigneeId.slice(0, 8)}…</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${overallPct >= 80 ? "bg-green-100 text-green-800" : overallPct >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                  {overallPct}%
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Bookings</span>
                    <span>{t.actualBookings ?? 0} / {t.targetBookings ?? 0}</span>
                  </div>
                  <ProgressBar value={bookingPct} color={color} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Revenue</span>
                    <span>₹{Number(t.actualRevenue ?? 0).toLocaleString("en-IN")} / ₹{Number(t.targetRevenue ?? 0).toLocaleString("en-IN")}</span>
                  </div>
                  <ProgressBar value={revPct} color={color} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Set Sales Target</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assignee ID (User UUID)</label>
              <input name="assigneeId" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="UUID of sales agent or manager" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Period</label>
              <select name="period" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Period Start</label>
              <input name="periodStart" type="date" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Bookings</label>
              <input name="targetBookings" type="number" min="0" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. 10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Revenue (₹)</label>
              <input name="targetRevenue" type="number" min="0" step="0.01" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. 5000000" />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Create Target"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
