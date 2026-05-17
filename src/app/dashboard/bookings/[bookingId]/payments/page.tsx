"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PaymentScheduleCard } from "@/components/PaymentScheduleCard";
import { MilestoneList } from "@/components/MilestoneList";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { PaymentHistoryTable } from "@/components/PaymentHistoryTable";
import { usePaymentSchedule } from "@/hooks/usePaymentSchedule";
import { usePaymentMilestones } from "@/hooks/usePaymentMilestones";
import { usePayments } from "@/hooks/usePayments";
import { useRecordPaymentMutation } from "@/hooks/useRecordPaymentMutation";
import { useBounceMutation } from "@/hooks/useBounceMutation";
import type { RecordPaymentRequest } from "@/types/api";

export default function PaymentsPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  const scheduleQuery = usePaymentSchedule(bookingId);
  const schedule = scheduleQuery.data?.data?.[0] ?? null;
  const scheduleId = schedule?.id ?? null;

  const milestonesQuery = usePaymentMilestones(scheduleId);
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

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Payments</h1>

      <PaymentScheduleCard
        schedule={schedule}
        isLoading={scheduleQuery.isLoading}
        isError={scheduleQuery.isError}
        onRetry={() => void scheduleQuery.refetch()}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
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

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Payment History
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
            <SheetTitle>Record Payment</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <RecordPaymentForm
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
