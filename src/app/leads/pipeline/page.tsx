"use client";

import * as React from "react";
import { useLeadPipeline, useUpdateLeadStatus, PIPELINE_STATUSES } from "@/hooks/useLeadPipeline";
import { LEAD_STAGES, type Lead, type LeadStage } from "@/types/api";
import { stageLabel } from "@/lib/utils";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * The "Move to…" dropdown must emit CANONICAL backend stage values
 * (`new | contacted | site_visit_scheduled | …`), not the board's display
 * column names.
 *
 * `PIPELINE_STATUSES` are display labels ("New", "Site Visit", "Converted")
 * produced by `normaliseStatus()` for grouping — several of them ("Site
 * Visit", "Converted") are not backend stages at all. Sending one produced
 * 400 "toStage must be one of the following values: new, contacted,
 * site_visit_scheduled, site_visit_done, negotiation, booking, lost", so
 * every stage move from this board silently did nothing.
 */
const MOVE_TARGETS: LeadStage[] = LEAD_STAGES;

function LeadCard({ lead }: { lead: Lead }) {
  const { mutate: updateStatus, isPending, error } = useUpdateLeadStatus();
  const [moveError, setMoveError] = React.useState<string | null>(null);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "12px",
        marginBottom: 8,
        fontSize: 14,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{lead.name}</div>
      {lead.phone && (
        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 4 }}>{lead.phone}</div>
      )}
      <div style={{ color: "#9ca3af", fontSize: 11, marginBottom: 8 }}>
        {formatDate(lead.createdAt)}
      </div>
      <select
        style={{
          width: "100%",
          fontSize: 12,
          border: "1px solid #d1d5db",
          borderRadius: 4,
          padding: "2px 4px",
          cursor: "pointer",
        }}
        value=""
        disabled={isPending}
        onChange={(e) => {
          const toStage = e.target.value;
          if (!toStage) return;
          setMoveError(null);
          updateStatus(
            { id: lead.id, status: toStage },
            {
              onError: (err) =>
                setMoveError(
                  err instanceof Error ? err.message : "Stage move failed",
                ),
            },
          );
        }}
      >
        <option value="" disabled>
          {isPending ? "Moving…" : "Move to…"}
        </option>
        {MOVE_TARGETS.filter((s) => s !== lead.stage).map((s) => (
          <option key={s} value={s}>
            {stageLabel(s)}
          </option>
        ))}
      </select>
      {moveError || error ? (
        <div style={{ color: "#b91c1c", fontSize: 11, marginTop: 4 }}>
          {moveError ?? (error as Error).message}
        </div>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: "#f3f4f6",
        borderRadius: 8,
        padding: "12px",
        marginBottom: 8,
        height: 80,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

export default function LeadPipelinePage() {
  const { columns, isLoading, isError, refetch } = useLeadPipeline();

  return (
    <main style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Lead Pipeline</h1>

      {isError && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "16px",
            color: "#b91c1c",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>Failed to load pipeline.</span>
          <button
            onClick={() => refetch()}
            style={{
              background: "#b91c1c",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 12,
          overflowX: "auto",
        }}
      >
        {PIPELINE_STATUSES.map((status) => {
          const leads = columns[status] ?? [];
          return (
            <div
              key={status}
              style={{
                background: "#f9fafb",
                borderRadius: 8,
                padding: "12px",
                minWidth: 180,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{status}</span>
                <span
                  style={{
                    background: "#e5e7eb",
                    borderRadius: 12,
                    padding: "1px 8px",
                    fontSize: 12,
                    color: "#374151",
                  }}
                >
                  {leads.length}
                </span>
              </div>

              {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : leads.length === 0 ? (
                <div style={{ color: "#d1d5db", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                  No leads
                </div>
              ) : (
                leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
