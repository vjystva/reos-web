"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LeadStageBadge } from "@/components/LeadStageBadge";
import { LeadStageSelect } from "@/components/LeadStageSelect";
import { LeadStageStepper } from "@/components/LeadStageStepper";
import { LeadNotesForm } from "@/components/LeadNotesForm";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { ConvertLeadButton } from "@/components/ConvertLeadButton";
import { useLead } from "@/hooks/useLead";
import { useDealer } from "@/hooks/useDealer";
import { useLeadActivities } from "@/hooks/useLeadActivities";
import { useTransitionLeadStageMutation } from "@/hooks/useTransitionLeadStageMutation";
import { formatDate, stageLabel } from "@/lib/utils";
import {
  activityDotClass,
  activityLabel,
  isTerminalLeadStage,
  nextLeadStage,
} from "@/lib/leadTone";
import type { LeadStage } from "@/types/api";

const DT = "text-[11px] uppercase tracking-wider text-muted-foreground";

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className={DT}>{label}</dt>
      <dd
        className={
          mono
            ? "font-mono text-xs tabular-nums text-foreground"
            : "text-xs text-foreground"
        }
      >
        {children}
      </dd>
    </div>
  );
}

export default function LeadDetailPage({ params }: { params: { leadId: string } }) {
  const { leadId } = params;
  const { data: lead, isLoading, isError, refetch } = useLead(leadId);
  /**
   * Stage moves go through `PATCH /api/leads/:id/status` (BFF → backend
   * `POST /leads/:id/stage`). They must NOT go through
   * `useUpdateLeadMutation({ stage })`: `stage` is not on the backend's
   * `UpdateLeadDto`, so `PATCH /leads/:id` answers
   * 400 "property stage should not exist" every single time — which is what
   * made every CTA on this page fail.
   */
  const stageMutation = useTransitionLeadStageMutation(leadId);
  // Channel-partner attribution (`leads.partner_id` → `dealers.id`). Disabled
  // until the lead loads and actually carries an attribution.
  const partnerQuery = useDealer(lead?.partnerId ?? null);
  // `GET /leads/:id` carries no activity array — the timeline is its own
  // endpoint (`GET /leads/:id/activities`), which is also where notes live.
  const activityQuery = useLeadActivities(leadId);

  /**
   * `lost` needs a reason (backend: 400 "lostReason is required when moving to
   * lost"), so selecting it stages an inline prompt instead of firing blind.
   */
  const [pendingLost, setPendingLost] = React.useState(false);
  const [lostReason, setLostReason] = React.useState("");

  const handleStageChange = (stage: LeadStage) => {
    stageMutation.reset();
    if (stage === "lost") {
      setPendingLost(true);
      return;
    }
    setPendingLost(false);
    stageMutation.mutate({ status: stage });
  };

  const confirmLost = () => {
    const reason = lostReason.trim();
    if (!reason) return;
    stageMutation.mutate(
      { status: "lost", lostReason: reason },
      {
        onSuccess: () => {
          setPendingLost(false);
          setLostReason("");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-56 lg:col-span-2" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="space-y-3">
        <ErrorBanner message="Could not load lead details." onRetry={() => void refetch()} />
      </div>
    );
  }

  const stageLocked = isTerminalLeadStage(lead.stage);
  const next = nextLeadStage(lead.stage);
  /**
   * Timeline rows come from `lead_activities`. `lead.activity` is kept as a
   * fallback for the demo/fixture shape, which does embed it.
   */
  const activity =
    activityQuery.data?.data.map((a) => ({
      id: a.id,
      type: a.activityType,
      description: a.body ?? undefined,
      occurredAt: a.createdAt,
    })) ??
    lead.activity ??
    [];
  const stageErrorMessage = stageMutation.error?.message ?? null;

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/pipeline"
        className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" aria-hidden="true" />
        Pipeline
      </Link>

      <PageHeader
        title={lead.name}
        subtitle={[lead.phone, lead.source].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <TemperatureBadge temperature={lead.temperature} />
            <LeadStageBadge stage={lead.stage} />
            <ConvertLeadButton leadId={leadId} stage={lead.stage} />
          </>
        }
      />

      {/* Stage stepper — visual position in the fixed 7-stage pipeline.
          Clickable while the lead is not in a terminal stage. */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Pipeline stage</CardTitle>
            {stageMutation.isPending ? (
              <span className="text-[11px] text-muted-foreground">Updating…</span>
            ) : stageLocked ? (
              <span className="text-[11px] text-muted-foreground">
                Terminal stage — locked
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <LeadStageStepper
            stage={lead.stage}
            onSelect={handleStageChange}
            disabled={stageLocked || stageMutation.isPending}
          />

          {/* `lost` is the one transition the backend refuses without a
              reason, so capture it here rather than firing a doomed call. */}
          {pendingLost ? (
            <div className="mt-2 space-y-1.5 rounded-sm border border-destructive/30 bg-destructive/5 p-2.5">
              <label
                htmlFor="lead-lost-reason"
                className="block text-[11px] uppercase tracking-wider text-muted-foreground"
              >
                Reason for loss (required)
              </label>
              <textarea
                id="lead-lost-reason"
                rows={2}
                maxLength={500}
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Budget mismatch, went with a competitor…"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!lostReason.trim() || stageMutation.isPending}
                  onClick={confirmLost}
                >
                  {stageMutation.isPending ? "Marking lost…" : "Mark as lost"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={stageMutation.isPending}
                  onClick={() => {
                    setPendingLost(false);
                    setLostReason("");
                    stageMutation.reset();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {/* Surface the backend's own message — "Invalid stage transition:
              contacted -> negotiation" is actionable; "try again" is not. */}
          {stageErrorMessage ? (
            <p className="mt-2 text-[11px] text-destructive">
              {stageErrorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* ── Buyer record ─────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle>Lead record</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              <Field label="Name">{lead.name || "—"}</Field>
              <Field label="Phone" mono>
                {lead.phone ?? "—"}
              </Field>
              <Field label="Email">{lead.email ?? "—"}</Field>
              <Field label="Source">{lead.source ?? "—"}</Field>
              <Field label="Stage">{stageLabel(lead.stage)}</Field>
              <Field label="Temperature">
                <TemperatureBadge temperature={lead.temperature} />
              </Field>
              <Field label="AI score" mono>
                {lead.aiScore ?? "—"}
              </Field>
              <Field label="Assigned dealer">
                {lead.assignedDealer?.name ?? lead.assignedTo ?? "—"}
              </Field>
              {lead.partnerId ? (
                <Field label="Channel partner">
                  {partnerQuery.data
                    ? [partnerQuery.data.name, partnerQuery.data.company]
                        .filter(Boolean)
                        .join(" · ")
                    : partnerQuery.isLoading
                      ? "Loading…"
                      : lead.partnerId}
                </Field>
              ) : null}
              <Field label="Project" mono>
                {lead.projectId ?? "—"}
              </Field>
              <Field label="Created" mono>
                {formatDate(lead.createdAt)}
              </Field>
            </dl>

            {/* Score breakdown — a disclosure, same `<details>` recipe as the
                Tasks page "Completed" section. Collapsed by default: it is
                diagnostic detail, not something the agent reads every visit. */}
            {lead.scoreBreakdown &&
            Object.keys(lead.scoreBreakdown).length > 0 ? (
              <details className="group mt-3 border-t border-border pt-3">
                <summary
                  className={`flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${DT}`}
                >
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                  Score breakdown
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                    {lead.aiScore ?? "—"}
                  </span>
                </summary>
                <dl className="mt-1.5 space-y-1">
                  {Object.entries(lead.scoreBreakdown).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">
                        {activityLabel(k)}
                      </dt>
                      <dd className="font-mono text-xs font-semibold tabular-nums text-foreground">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : null}
          </CardContent>
        </Card>

        {/* ── Engagement: timeline + next action ───────────────────────── */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Engagement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No activity logged yet.
              </p>
            ) : (
              <ol className="space-y-2.5">
                {activity.map((a, i) => (
                  <li key={a.id ?? i} className="relative flex gap-2.5 pl-0.5">
                    <span className="relative flex flex-col items-center">
                      <span
                        aria-hidden="true"
                        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${activityDotClass(a.type)}`}
                      />
                      {i < activity.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className="mt-0.5 w-px flex-1 bg-border"
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0 pb-0.5">
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
            )}

            {/* Next action — the signature amber callout closing the timeline. */}
            {next ? (
              <div className="rounded-sm border border-accent/30 bg-accent/10 p-2.5">
                <p className={DT}>Next action</p>
                <p className="mt-1 text-xs font-medium text-foreground">
                  Move this lead to {stageLabel(next)}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={stageMutation.isPending}
                  onClick={() => handleStageChange(next)}
                >
                  {stageMutation.isPending
                    ? "Updating…"
                    : `Advance to ${stageLabel(next)}`}
                </Button>
              </div>
            ) : (
              <div className="rounded-sm border border-border bg-muted/50 p-2.5">
                <p className={DT}>Next action</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lead.stage === "booking"
                    ? "Lead converted — nothing left in the pipeline."
                    : "Lead is closed as lost."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Notes are activity rows (`lead_activities.activity_type =
                'note'`) — `leads` has no notes column, so saving appends to
                the Engagement timeline rather than overwriting a field. */}
            <LeadNotesForm leadId={leadId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Change stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <LeadStageSelect
              id="lead-stage-select"
              value={lead.stage}
              onChange={handleStageChange}
              disabled={stageMutation.isPending || stageLocked}
            />
            <p className="text-[11px] text-muted-foreground">
              {stageLocked
                ? "Booked and lost leads cannot be moved."
                : "Same as clicking a step above."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
