"use client";
import * as React from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LeadStageBadge } from "@/components/LeadStageBadge";
import { LeadStageSelect } from "@/components/LeadStageSelect";
import { LeadNotesForm } from "@/components/LeadNotesForm";
import { ConvertLeadButton } from "@/components/ConvertLeadButton";
import { useLead } from "@/hooks/useLead";
import { useUpdateLeadMutation } from "@/hooks/useUpdateLeadMutation";
import type { LeadStage } from "@/types/api";

export default function LeadDetailPage({ params }: { params: { leadId: string } }) {
  const { leadId } = params;
  const { data: lead, isLoading, isError, refetch } = useLead(leadId);
  const updateMutation = useUpdateLeadMutation(leadId);

  const handleStageChange = (stage: LeadStage) => {
    updateMutation.mutate({ stage });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="p-6">
        <ErrorBanner message="Could not load lead details." onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/leads" className="text-sm text-indigo-600 hover:underline">← Leads</Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-semibold text-slate-900">{lead.name}</h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Stage</span>
          <LeadStageBadge stage={lead.stage} />
        </div>
        {lead.email && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <span className="text-sm text-slate-600">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Phone</span>
            <span className="text-sm text-slate-600">{lead.phone}</span>
          </div>
        )}
        {lead.source && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Source</span>
            <span className="text-sm text-slate-600">{lead.source}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Change Stage</h2>
        <LeadStageSelect
          value={lead.stage}
          onChange={handleStageChange}
          disabled={updateMutation.isPending || lead.stage === "booking" || lead.stage === "lost"}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Notes</h2>
        <LeadNotesForm leadId={leadId} initialNotes={lead.notes ?? ""} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <ConvertLeadButton leadId={leadId} stage={lead.stage} />
      </div>
    </div>
  );
}
