"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SiteVisitList } from "@/components/SiteVisitList";
import { RescheduleForm } from "@/components/RescheduleForm";
import { CancelVisitForm } from "@/components/CancelVisitForm";
import { ScheduleVisitForm } from "@/components/ScheduleVisitForm";
import { useSiteVisits } from "@/hooks/useSiteVisits";
import { useBookingDetail } from "@/hooks/useBookingDetail";
import { useConfirmVisitMutation } from "@/hooks/useConfirmVisitMutation";
import { useRescheduleVisitMutation } from "@/hooks/useRescheduleVisitMutation";
import { useCancelVisitMutation } from "@/hooks/useCancelVisitMutation";
import { useCompleteVisitMutation } from "@/hooks/useCompleteVisitMutation";
import { useScheduleVisitMutation } from "@/hooks/useScheduleVisitMutation";
import type {
  SiteVisit,
  RescheduleVisitRequest,
  CancelVisitRequest,
  ScheduleVisitRequest,
} from "@/types/api";

type SheetMode = "reschedule" | "cancel" | "schedule" | null;

export default function SiteVisitsPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  // `site_visits` are LEAD-scoped upstream (no booking_id column), so the lead
  // behind this booking is what actually addresses them — both for the list
  // and for scheduling a new one.
  const bookingQuery = useBookingDetail(bookingId);
  const leadId = bookingQuery.data?.leadId ?? null;

  const visitsQuery = useSiteVisits({ bookingId });
  const confirmMutation = useConfirmVisitMutation();
  const rescheduleMutation = useRescheduleVisitMutation();
  const cancelMutation = useCancelVisitMutation();
  const completeMutation = useCompleteVisitMutation();
  const scheduleMutation = useScheduleVisitMutation();

  const [sheetMode, setSheetMode] = React.useState<SheetMode>(null);
  const [activeVisit, setActiveVisit] = React.useState<SiteVisit | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [completingId, setCompletingId] = React.useState<string | null>(null);

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

  function openSchedule() {
    setActiveVisit(null);
    setFormError(null);
    setSheetMode("schedule");
  }

  function closeSheet() {
    setSheetMode(null);
    setActiveVisit(null);
    setFormError(null);
  }

  async function handleConfirm(visit: SiteVisit) {
    setConfirmingId(visit.id);
    setActionError(null);
    try {
      await confirmMutation.mutateAsync({ visitId: visit.id, bookingId });
    } catch (e) {
      setActionError((e as Error).message ?? "Failed to confirm visit.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleComplete(visit: SiteVisit) {
    setCompletingId(visit.id);
    setActionError(null);
    try {
      await completeMutation.mutateAsync({ visitId: visit.id, bookingId });
    } catch (e) {
      setActionError((e as Error).message ?? "Failed to complete visit.");
    } finally {
      setCompletingId(null);
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

  async function handleSchedule(data: ScheduleVisitRequest) {
    setFormError(null);
    try {
      await scheduleMutation.mutateAsync({ body: data, bookingId });
      closeSheet();
    } catch (e) {
      setFormError((e as Error).message ?? "Failed to schedule visit.");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Site Visits</h1>
          <p className="mt-1 text-sm text-slate-500">
            Schedule, confirm, reschedule, complete or cancel customer site
            visits for this booking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/bookings/${bookingId}/payments`}>
              Payments
            </Link>
          </Button>
          <Button
            onClick={openSchedule}
            disabled={!leadId}
            title={
              leadId ? undefined : "Loading the booking's lead…"
            }
          >
            + Schedule visit
          </Button>
        </div>
      </header>

      {actionError ? (
        <ErrorBanner
          message={actionError}
          onRetry={() => setActionError(null)}
          retryLabel="Dismiss"
        />
      ) : null}

      <SiteVisitList
        visits={visitsQuery.data?.data}
        isLoading={visitsQuery.isLoading}
        isError={visitsQuery.isError}
        onRetry={() => void visitsQuery.refetch()}
        onConfirm={(v) => void handleConfirm(v)}
        onReschedule={openReschedule}
        onCancel={openCancel}
        onComplete={(v) => void handleComplete(v)}
        confirmingId={confirmingId}
        completingId={completingId}
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
              {sheetMode === "reschedule"
                ? "Reschedule visit"
                : sheetMode === "cancel"
                  ? "Cancel visit"
                  : "Schedule visit"}
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
            {sheetMode === "schedule" && leadId ? (
              <ScheduleVisitForm
                leadId={leadId}
                isSubmitting={scheduleMutation.isPending}
                error={formError}
                onSubmit={(data) => void handleSchedule(data)}
                onCancel={closeSheet}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
