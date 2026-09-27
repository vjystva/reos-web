"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBulkUpdateUnitStatusMutation } from "@/hooks/useBulkUpdateUnitStatusMutation";
import { bulkStatusEligibility, requiresNote } from "@/lib/unitTransitions";
import { unitStatusLabel } from "@/lib/unitTone";
import type { BulkResult, Unit, UnitStatus } from "@/types/api";

/** Server-side `MAX_ITEMS` in `reos-backend/src/bulk/bulk.service.ts`. */
const MAX_ITEMS = 100;

interface UnitBulkStatusBarProps {
  projectId: string;
  /** The selected units, resolved from the rows currently on screen. */
  selected: Unit[];
  /** Current user's role — gates targets via `UNIT_TRANSITION_ROLES`. */
  role: string | null | undefined;
  onClearSelection: () => void;
  /** Called after a run that changed at least one unit. */
  onApplied?: (result: BulkResult) => void;
}

/**
 * Bulk action toolbar for the units table. Appears only when ≥1 row is checked.
 *
 * Two actions, the two an inventory admin actually does in bulk: Block (hold a
 * floor/tower out of sale) and Release (put it back). Anything further along the
 * lifecycle — booked, agreement_signed, registered — stays a per-unit decision
 * in the slide-over, because those carry money and paperwork.
 *
 * Batches over `MAX_ITEMS` are chunked: the backend rejects >100 items outright
 * (400 for the whole batch), and "select all on this floor" can plausibly exceed
 * that.
 */
export function UnitBulkStatusBar({
  projectId,
  selected,
  role,
  onClearSelection,
  onApplied,
}: UnitBulkStatusBarProps) {
  const [note, setNote] = React.useState("");
  const [result, setResult] = React.useState<BulkResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = React.useState<UnitStatus | null>(
    null,
  );
  const mutation = useBulkUpdateUnitStatusMutation(projectId);

  const blockable = bulkStatusEligibility(selected, "blocked", role);
  const releasable = bulkStatusEligibility(selected, "available", role);

  if (selected.length === 0) return null;

  async function apply(target: UnitStatus) {
    const { eligible, skipped } = bulkStatusEligibility(selected, target, role);
    setError(null);
    setResult(null);
    if (eligible.length === 0) {
      setError(
        `None of the ${selected.length} selected unit(s) can move to ${unitStatusLabel(
          target,
        )} — ${skipped[0]?.reason ?? "no eligible units"}.`,
      );
      return;
    }
    const trimmed = note.trim();
    if (requiresNote(target) && !trimmed) {
      setError(`A note is required to move units to ${unitStatusLabel(target)}.`);
      return;
    }

    setPendingTarget(target);
    try {
      // Chunked so a >100 selection does not get rejected wholesale.
      const merged: BulkResult = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      };
      for (let i = 0; i < eligible.length; i += MAX_ITEMS) {
        const chunk = eligible.slice(i, i + MAX_ITEMS);
        const res = await mutation.mutateAsync({
          items: chunk.map((u) => ({
            id: u.id,
            status: target,
            ...(trimmed ? { note: trimmed } : {}),
          })),
        });
        merged.processed += res.processed;
        merged.succeeded += res.succeeded;
        merged.failed += res.failed;
        merged.results.push(...res.results);
      }
      setResult(merged);
      setNote("");
      if (merged.succeeded > 0) {
        onApplied?.(merged);
        onClearSelection();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bulk status update failed.",
      );
    } finally {
      setPendingTarget(null);
    }
  }

  const busy = pendingTarget !== null;
  const unitLabel = (id: string) => {
    const u = selected.find((s) => s.id === id);
    return u?.unitNumber ?? id.slice(0, 8);
  };

  return (
    <div
      role="region"
      aria-label="Bulk unit actions"
      className="flex flex-col gap-2 rounded-md border border-accent/40 bg-accent/10 p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="bulk-selection-count"
          className="text-xs font-medium text-foreground"
        >
          {selected.length} selected
        </span>

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional, saved to unit history)"
          aria-label="Bulk status change note"
          maxLength={1000}
          className="h-7 w-64"
        />

        <Button
          size="sm"
          variant="outline"
          disabled={busy || blockable.eligible.length === 0}
          onClick={() => void apply("blocked")}
          title={
            blockable.eligible.length === 0
              ? "No selected unit can be blocked"
              : `Block ${blockable.eligible.length} unit(s)`
          }
        >
          {pendingTarget === "blocked" ? "Blocking…" : "Block selected"}
          {blockable.eligible.length > 0
            ? ` (${blockable.eligible.length})`
            : ""}
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={busy || releasable.eligible.length === 0}
          onClick={() => void apply("available")}
          title={
            releasable.eligible.length === 0
              ? "No selected unit can be released"
              : `Release ${releasable.eligible.length} unit(s)`
          }
        >
          {pendingTarget === "available" ? "Releasing…" : "Release selected"}
          {releasable.eligible.length > 0
            ? ` (${releasable.eligible.length})`
            : ""}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setResult(null);
            setError(null);
            onClearSelection();
          }}
        >
          Clear
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="text-[11px] text-muted-foreground" data-testid="bulk-result">
          <span className="text-foreground">
            {result.succeeded} of {result.processed} updated
          </span>
          {result.failed > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {result.results
                .filter((r) => !r.success)
                .slice(0, 10)
                .map((r) => (
                  <li key={r.id}>
                    Unit {unitLabel(r.id)}: {r.error ?? "failed"}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
