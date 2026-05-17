"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SiteVisitList } from "@/components/SiteVisitList";
import { RescheduleForm } from "@/components/RescheduleForm";
import { CancelVisitForm } from "@/components/CancelVisitForm";
import { useSiteVisits } from "@/hooks/useSiteVisits";
import { useConfirmVisitMutation } from "@/hooks/useConfirmVisitMutation";
import { useRescheduleVisitMutation } from "@/hooks/useRescheduleVisitMutation";
import { useCancelVisitMutation } from "@/hooks/useCancelVisitMutation";
import type {
  SiteVisit,
  RescheduleVisitRequest,
  CancelVisitRequest,
} from "@/types/api";

type SheetMode = "reschedule" | "cancel" | null;

export default function SiteVisitsPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  const visitsQuery = useSiteVisits({ bookingId });
  const confirmMutation = useConfirmVisitMutation();
  const rescheduleMutation = useRescheduleVisitMutation();
  const cancelMutation = useCancelVisitMutation();

  const [sheetMode, setSheetMode] = React.useState<SheetMode>(null);
  const [activeVisit, setActiveVisit] = React.useState<SiteVisit | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  function openReschedule(visit: SiteVisit) {
    setActiveVisit(visit);
    setFormError(null);
    setSheetMode("reschedule");
  }

  function openCancel(visit: SiteVisit) {
    setActiveVisit(visit);
    setFormError(null);
    setSheetMode("cancel");
  }

  function closeSheet() {
    setSheetMode(null);
    setActiveVisit(null);
    setFormError(null);
  }

  async function handleConfirm(visit: SiteVisit) {
    setConfirmingId(visit.id);
    try {
      await confirmMutation.mutateAsync({ visitId: visit.id, bookingId });
    } catch (e) {
      // Surface error via the list-level error banner. Fall back to alert
      // because the list has no per-row error UI.
      window.alert((e as Error).message ?? "Failed to confirm visit.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleReschedule(data: RescheduleVisitRequest) {
    if (!activeVisit) return;
    setFormError(null);
    try {
      await rescheduleMutation.mutateAsync({
        visitId: activeVisit.id,
        bookingId,
        body: data,
      });
      closeSheet();
    } catch (e) {
      setFormError((e as Error).message ?? "Failed to reschedule visit.");
    }
  }

  async function handleCancel(data: CancelVisitRequest) {
    if (!activeVisit) return;
    setFormError(null);
    try {
      await cancelMutation.mutateAsync({
        visitId: activeVisit.id,
        bookingId,
        body: data,
      });
      closeSheet();
    } catch (e) {
      setFormError((e as Error).message ?? "Failed to cancel visit.");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Site Visits</h1>
        <p className="mt-1 text-sm text-slate-500">
          Schedule, confirm, reschedule, or cancel customer site visits for this booking.
        </p>
      </header>

      <SiteVisitList
        visits={visitsQuery.data?.data}
        isLoading={visitsQuery.isLoading}
        isError={visitsQuery.isError}
        onRetry={() => void visitsQuery.refetch()}
        onConfirm={(v) => void handleConfirm(v)}
        onReschedule={openReschedule}
        onCancel={openCancel}
        confirmingId={confirmingId}
      />

      <Sheet
        open={sheetMode !== null}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {sheetMode === "reschedule" ? "Reschedule visit" : "Cancel visit"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {sheetMode === "reschedule" && activeVisit ? (
              <RescheduleForm
                defaultVisitDate={activeVisit.visitDate}
                isSubmitting={rescheduleMutation.isPending}
                error={formError}
                onSubmit={(data) => void handleReschedule(data)}
                onCancel={closeSheet}
              />
            ) : null}
            {sheetMode === "cancel" && activeVisit ? (
              <CancelVisitForm
                isSubmitting={cancelMutation.isPending}
                error={formError}
                onSubmit={(data) => void handleCancel(data)}
                onCancel={closeSheet}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
