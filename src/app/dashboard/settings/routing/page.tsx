"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/StatusPill";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDealers } from "@/hooks/useDealers";
import { useProjects } from "@/hooks/useProjects";
import { useUsers } from "@/hooks/useUsers";
import { useLeadRoutingRules } from "@/hooks/useLeadRoutingRules";
import { useRoutingMode } from "@/hooks/useRoutingMode";
import { useCreateLeadRoutingRuleMutation } from "@/hooks/useCreateLeadRoutingRuleMutation";
import { useDeleteLeadRoutingRuleMutation } from "@/hooks/useDeleteLeadRoutingRuleMutation";
import { useReorderLeadRoutingRulesMutation } from "@/hooks/useReorderLeadRoutingRulesMutation";
import { useUpdateLeadRoutingRuleMutation } from "@/hooks/useUpdateLeadRoutingRuleMutation";
import { useUpdateRoutingModeMutation } from "@/hooks/useUpdateRoutingModeMutation";
import {
  LEAD_SOURCES,
  ROUTING_MODES,
  ROUTING_MODE_LABELS,
  type LeadRoutingRule,
  type LeadSource,
  type RoutingMode,
  type UpdateLeadRoutingRuleRequest,
} from "@/types/api";

const SOURCE_LABELS: Record<LeadSource, string> = {
  web_form: "Website / Web Form",
  whatsapp: "WhatsApp",
  phone: "Phone Call",
  csv_import: "CSV Import",
  third_party_api: "Agent / Referral",
};

const MODE_DESCRIPTIONS: Record<RoutingMode, string> = {
  round_robin:
    "Every inbound lead goes to the next dealer in the assignment queue.",
  rules:
    "Rules below are evaluated top to bottom — the first match wins. Unmatched leads fall back to round robin.",
};

/**
 * Editable draft of one rule. `id === null` means "not persisted yet" — those
 * rows become POSTs on save. `priority` is the server-side value we diff
 * against to decide whether a reorder call is needed.
 */
interface DraftRule {
  key: string;
  id: string | null;
  source: LeadSource | null;
  projectId: string | null;
  targetDealerId: string;
  isActive: boolean;
  priority: number;
}

let draftKeySeq = 0;
function nextDraftKey(): string {
  draftKeySeq += 1;
  return `draft-${draftKeySeq}`;
}

function toDraft(rule: LeadRoutingRule): DraftRule {
  return {
    key: rule.id,
    id: rule.id,
    source: rule.source,
    projectId: rule.projectId,
    targetDealerId: rule.targetDealerId,
    isActive: rule.isActive,
    priority: rule.priority,
  };
}

/** Ignores `key` so a re-fetch that returns identical rows is not "dirty". */
function signature(rules: DraftRule[]): string {
  return JSON.stringify(
    rules.map((r) => [
      r.id,
      r.source,
      r.projectId,
      r.targetDealerId,
      r.isActive,
    ]),
  );
}

/** Two-option segmented control — same recipe as the pipeline view toggle. */
function StrategyToggle({
  value,
  onChange,
  disabled,
}: {
  value: RoutingMode;
  onChange: (mode: RoutingMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Assignment strategy"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5"
    >
      {ROUTING_MODES.map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(mode)}
            className={`h-7 rounded-sm px-3 text-[11px] font-medium uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {ROUTING_MODE_LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
}

export default function LeadRoutingSettingsPage() {
  const modeQuery = useRoutingMode();
  const rulesQuery = useLeadRoutingRules();
  const projectsQuery = useProjects({ pageSize: 200 });
  const usersQuery = useUsers();
  const dealersQuery = useDealers();
  const currentUserQuery = useCurrentUser();

  const setModeMutation = useUpdateRoutingModeMutation();
  const createMutation = useCreateLeadRoutingRuleMutation();
  const updateMutation = useUpdateLeadRoutingRuleMutation();
  const deleteMutation = useDeleteLeadRoutingRuleMutation();
  const reorderMutation = useReorderLeadRoutingRulesMutation();

  const [draft, setDraft] = React.useState<DraftRule[]>([]);
  const [baseline, setBaseline] = React.useState<DraftRule[]>([]);
  const [mode, setMode] = React.useState<RoutingMode>("round_robin");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const serverMode = modeQuery.data?.routingMode;
  const serverRules = rulesQuery.data?.data;
  const serverSigRef = React.useRef<string | null>(null);

  // Adopt server state whenever it actually changes. Neither query polls, so
  // this only fires on first load, on an explicit refetch, or after a save.
  React.useEffect(() => {
    if (!serverRules) return;
    const next = serverRules.map(toDraft);
    const sig = signature(next);
    if (sig === serverSigRef.current) return;
    serverSigRef.current = sig;
    setBaseline(next);
    setDraft(next);
  }, [serverRules]);

  React.useEffect(() => {
    if (serverMode) setMode(serverMode);
  }, [serverMode]);

  // The backend validates targetDealerId against `users` (role='dealer') — the
  // `dealers` partner directory is a separate id-space — so the option list is
  // built from users and only *labelled* from the dealer directory.
  const dealerOptions = React.useMemo(() => {
    const nameById = new Map(
      (dealersQuery.data?.dealers ?? []).map((d) => [d.id, d.name]),
    );
    const options = (usersQuery.data?.data ?? [])
      .filter((u) => u.role === "dealer")
      .map((u) => ({ id: u.id, label: nameById.get(u.id) ?? u.email }));
    // Keep any already-assigned owner selectable even if it is not in the list
    // (e.g. a deactivated account), so opening the page cannot silently drop it.
    const known = new Set(options.map((o) => o.id));
    for (const r of draft) {
      if (r.targetDealerId && !known.has(r.targetDealerId)) {
        known.add(r.targetDealerId);
        options.push({
          id: r.targetDealerId,
          label:
            nameById.get(r.targetDealerId) ??
            `Unknown owner (${r.targetDealerId.slice(0, 8)}…)`,
        });
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [dealersQuery.data, usersQuery.data, draft]);

  const projectOptions = projectsQuery.data?.data ?? [];

  const isDirty =
    signature(draft) !== signature(baseline) || mode !== (serverMode ?? mode);

  // routing-mode PUT is builder_admin-only upstream. Unknown role (the /api/me
  // fallback) stays permissive, matching the rest of the app.
  const role = currentUserQuery.data?.role ?? null;
  const canEditMode = role === null || role === "builder_admin";

  const isLoading = modeQuery.isLoading || rulesQuery.isLoading;

  function patchRow(index: number, patch: Partial<DraftRule>) {
    setDraft((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  function addRule() {
    setSaveError(null);
    setDraft((prev) => [
      ...prev,
      {
        key: nextDraftKey(),
        id: null,
        source: null,
        projectId: null,
        targetDealerId: "",
        isActive: true,
        priority: prev.length,
      },
    ]);
  }

  function removeRule(index: number) {
    setSaveError(null);
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    setDraft((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleReset() {
    setSaveError(null);
    setDraft(baseline);
    if (serverMode) setMode(serverMode);
  }

  /**
   * There is no bulk-save endpoint upstream, so Save flushes the diff:
   * PUT routing-mode → DELETE removed → PATCH changed → POST new →
   * PATCH /reorder for everything whose position moved.
   */
  async function handleSave() {
    setSaveError(null);
    if (draft.some((r) => !r.targetDealerId)) {
      setSaveError("Every rule needs an owner before it can be saved.");
      return;
    }

    setIsSaving(true);
    try {
      if (serverMode && mode !== serverMode) {
        await setModeMutation.mutateAsync({ routingMode: mode });
      }

      const keptIds = new Set(
        draft.filter((r) => r.id !== null).map((r) => r.id as string),
      );
      for (const base of baseline) {
        if (base.id && !keptIds.has(base.id)) {
          await deleteMutation.mutateAsync(base.id);
        }
      }

      const byId = new Map(baseline.filter((b) => b.id).map((b) => [b.id, b]));
      const reorder: Array<{ id: string; priority: number }> = [];

      for (let i = 0; i < draft.length; i += 1) {
        const row = draft[i];
        if (row.id === null) {
          await createMutation.mutateAsync({
            source: row.source,
            projectId: row.projectId,
            targetDealerId: row.targetDealerId,
            priority: i,
            isActive: row.isActive,
          });
          continue;
        }

        const base = byId.get(row.id);
        const body: UpdateLeadRoutingRuleRequest = {};
        if (base?.source !== row.source) body.source = row.source;
        if (base?.projectId !== row.projectId) body.projectId = row.projectId;
        if (base?.targetDealerId !== row.targetDealerId) {
          body.targetDealerId = row.targetDealerId;
        }
        if (base?.isActive !== row.isActive) body.isActive = row.isActive;
        if (Object.keys(body).length > 0) {
          await updateMutation.mutateAsync({ ruleId: row.id, body });
        }
        if (base?.priority !== i) reorder.push({ id: row.id, priority: i });
      }

      if (reorder.length > 0) {
        await reorderMutation.mutateAsync({ rules: reorder });
      }

      await Promise.all([rulesQuery.refetch(), modeQuery.refetch()]);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save lead routing",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Lead routing"
        subtitle="Decide how inbound leads are assigned to owners."
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!isDirty || isSaving}
            >
              Reset
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      {saveError ? <ErrorBanner message={saveError} /> : null}

      {modeQuery.isError || rulesQuery.isError ? (
        <ErrorBanner
          message="Failed to load lead routing settings."
          onRetry={() => {
            void modeQuery.refetch();
            void rulesQuery.refetch();
          }}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Assignment strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-8 w-56" />
          ) : (
            <>
              <StrategyToggle
                value={mode}
                onChange={(next) => {
                  setSaveError(null);
                  setMode(next);
                }}
                disabled={!canEditMode || isSaving}
              />
              <p className="text-xs text-muted-foreground">
                {MODE_DESCRIPTIONS[mode]}
              </p>
              {!canEditMode ? (
                <p className="text-[11px] text-muted-foreground">
                  Only a builder admin can change the strategy. Rules below can
                  still be edited.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Routing rules</CardTitle>
          <div className="flex items-center gap-2">
            {mode === "round_robin" ? (
              <StatusPill tone="warn">Not applied in round robin</StatusPill>
            ) : null}
            <Button variant="outline" size="sm" onClick={addRule}>
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : draft.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
              No routing rules yet. Add one to send leads from a source or
              project straight to a specific owner.
            </div>
          ) : (
            <ul role="list" className="space-y-1.5">
              {draft.map((row, index) => (
                <li
                  key={row.key}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border px-2 py-1.5"
                >
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>

                  <label className="min-w-0">
                    <span className="sr-only">{`Source for rule ${index + 1}`}</span>
                    <Select
                      value={row.source ?? ""}
                      onChange={(e) =>
                        patchRow(index, {
                          source: (e.target.value || null) as LeadSource | null,
                        })
                      }
                    >
                      <option value="">Any source</option>
                      {LEAD_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {SOURCE_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="min-w-0">
                    <span className="sr-only">{`Project for rule ${index + 1}`}</span>
                    <Select
                      value={row.projectId ?? ""}
                      onChange={(e) =>
                        patchRow(index, { projectId: e.target.value || null })
                      }
                    >
                      <option value="">Any project</option>
                      {projectOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <span
                    aria-hidden="true"
                    className="text-center text-xs text-muted-foreground"
                  >
                    →
                  </span>

                  <label className="min-w-0">
                    <span className="sr-only">{`Owner for rule ${index + 1}`}</span>
                    <Select
                      value={row.targetDealerId}
                      aria-invalid={!row.targetDealerId}
                      onChange={(e) =>
                        patchRow(index, { targetDealerId: e.target.value })
                      }
                      className={
                        row.targetDealerId ? undefined : "border-destructive"
                      }
                    >
                      <option value="">Select owner…</option>
                      {dealerOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        patchRow(index, { isActive: !row.isActive })
                      }
                      aria-pressed={row.isActive}
                      title={
                        row.isActive
                          ? "Rule is active — click to pause"
                          : "Rule is paused — click to activate"
                      }
                    >
                      {row.isActive ? "Active" : "Paused"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move rule ${index + 1} up`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => move(index, 1)}
                      disabled={index === draft.length - 1}
                      aria-label={`Move rule ${index + 1} down`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRule(index)}
                      aria-label={`Remove rule ${index + 1}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Rules are evaluated top to bottom — the first match wins. A lead
            that matches nothing falls back to the round-robin queue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
