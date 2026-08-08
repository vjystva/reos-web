"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { PaymentScheduleCard } from "@/components/PaymentScheduleCard";
import { MilestoneList } from "@/components/MilestoneList";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { PaymentHistoryTable } from "@/components/PaymentHistoryTable";
import { usePaymentSchedule } from "@/hooks/usePaymentSchedule";
import { usePaymentMilestones } from "@/hooks/usePaymentMilestones";
import { usePayments } from "@/hooks/usePayments";
import { useBookingDetail } from "@/hooks/useBookingDetail";
import { useRecordPaymentMutation } from "@/hooks/useRecordPaymentMutation";
import { useBounceMutation } from "@/hooks/useBounceMutation";
import {
  bookingStatusLabel,
  bookingStatusTone,
  collectionPercent,
} from "@/lib/bookingTone";
import { inr } from "@/lib/utils";
import type { RecordPaymentRequest } from "@/types/api";

export default function PaymentsPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  const bookingQuery = useBookingDetail(bookingId);
  const scheduleQuery = usePaymentSchedule(bookingId);
  const schedule = scheduleQuery.data?.data?.[0] ?? null;
  const scheduleId = schedule?.id ?? null;

  // Milestones are addressed by BOOKING upstream
  // (`GET /bookings/:bookingId/payment-schedule/milestones`); `scheduleId`
  // only gates the query and keys the cache.
  const milestonesQuery = usePaymentMilestones(scheduleId, bookingId);
  const paymentsQuery = usePayments(bookingId);

  const recordMutation = useRecordPaymentMutation();
  const bounceMutation = useBounceMutation();

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [activeMilestoneId, setActiveMilestoneId] = React.useState<
    string | undefined
  >(undefined);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [bouncingId, setBouncingId] = React.useState<string | null>(null);

  function openRecordSheet(milestoneId: string) {
    setActiveMilestoneId(milestoneId);
    setFormError(null);
    setSheetOpen(true);
  }

  async function handleRecordPayment(data: RecordPaymentRequest) {
    if (!scheduleId) return;
    setFormError(null);
    try {
      await recordMutation.mutateAsync({
        body: data,
        scheduleId,
        bookingId,
      });
      setSheetOpen(false);
    } catch (e) {
      setFormError((e as Error).message ?? "Failed to record payment.");
    }
  }

  async function handleBounce(paymentId: string) {
    if (!scheduleId) return;
    setBouncingId(paymentId);
    try {
      await bounceMutation.mutateAsync({ paymentId, scheduleId, bookingId });
    } finally {
      setBouncingId(null);
    }
  }

  const booking = bookingQuery.data;
  const bookingNumber = booking?.bookingNumber ?? bookingId.slice(0, 8);

  const outstanding =
    schedule != null
      ? (schedule.outstanding ?? schedule.totalAmount - schedule.amountPaid)
      : null;
  const percent = schedule
    ? collectionPercent(schedule.amountPaid, schedule.totalAmount)
    : null;

  const milestones = milestonesQuery.data ?? [];
  const paidMilestones = milestones.filter(
    (m) => m.derivedStatus === "paid",
  ).length;
  const overdueMilestones = milestones.filter(
    (m) => m.derivedStatus === "overdue",
  ).length;

  const tilesLoading = scheduleQuery.isLoading;
  const tilesError = scheduleQuery.isError;

  return (
    <div className="space-y-3">
      <PageHeader
        title={`Payments · ${bookingNumber}`}
        subtitle={
          // `PaymentScheduleResponseDto` has no `name` field, so keying the
          // "no schedule" copy off `schedule?.name` printed "No payment
          // schedule on file" on every booking that DID have one. Key off the
          // schedule itself.
          scheduleQuery.isLoading
            ? undefined
            : schedule
              ? (schedule.name ?? "Payment schedule")
              : "No payment schedule on file"
        }
        actions={
          <>
            {booking?.status ? (
              <StatusPill tone={bookingStatusTone(booking.status)}>
                {bookingStatusLabel(booking.status)}
              </StatusPill>
            ) : null}
            <Button variant="outline" asChild>
              <Link href={`/dashboard/bookings/${bookingId}/site-visits`}>
                Site visits
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/bookings">All bookings</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard
          label="Booked value"
          value={schedule ? inr(schedule.totalAmount) : null}
          isLoading={tilesLoading}
          isError={tilesError}
        />
        <MetricCard
          label="Collected"
          value={schedule ? inr(schedule.amountPaid) : null}
          hint={percent != null ? `${percent}% of booked value` : undefined}
          isLoading={tilesLoading}
          isError={tilesError}
        />
        <MetricCard
          label="Outstanding"
          value={outstanding != null ? inr(outstanding) : null}
          hint={percent != null ? `${100 - percent}% still to collect` : undefined}
          isLoading={tilesLoading}
          isError={tilesError}
        />
        <MetricCard
          label="Milestones paid"
          value={
            milestonesQuery.isLoading || milestones.length === 0
              ? null
              : `${paidMilestones}/${milestones.length}`
          }
          subLabels={[{ label: "overdue", value: overdueMilestones }]}
          isLoading={milestonesQuery.isLoading}
          isError={milestonesQuery.isError}
        />
      </div>

      <PaymentScheduleCard
        schedule={schedule}
        isLoading={scheduleQuery.isLoading}
        isError={scheduleQuery.isError}
        onRetry={() => void scheduleQuery.refetch()}
      />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Milestones
        </h2>
        <MilestoneList
          milestones={milestonesQuery.data}
          isLoading={milestonesQuery.isLoading}
          isError={milestonesQuery.isError}
          onRetry={() => void milestonesQuery.refetch()}
          onRecordPayment={openRecordSheet}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Payment history
        </h2>
        <PaymentHistoryTable
          payments={paymentsQuery.data?.data}
          isLoading={paymentsQuery.isLoading}
          isError={paymentsQuery.isError}
          onRetry={() => void paymentsQuery.refetch()}
          onBounce={(id) => void handleBounce(id)}
          bouncingId={bouncingId}
        />
      </section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record payment</SheetTitle>
            <SheetDescription>
              Log a receipt against a milestone on this schedule.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <RecordPaymentForm
              bookingId={bookingId}
              milestones={milestonesQuery.data ?? []}
              defaultMilestoneId={activeMilestoneId}
              isSubmitting={recordMutation.isPending}
              error={formError}
              onSubmit={(data) => void handleRecordPayment(data)}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
