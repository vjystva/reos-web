"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateApprovalMutation } from "@/hooks/useCreateApprovalMutation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  CreateDiscountApprovalRequestSchema,
  DISCOUNT_APPROVAL_THRESHOLD_PERCENT,
} from "@/types/api";

/**
 * "Discount" row action on the bookings table — the entry point that feeds the
 * approvals queue with `discount_request`s.
 *
 * Only offered to the roles `POST /approvals` accepts (agent / manager / admin);
 * `dealer` and `customer` can see bookings but have no business asking for a
 * margin concession, and the backend would 403 them anyway.
 *
 * The >2% rule is enforced client-side purely to avoid a round trip on a known
 * rejection — the backend is the authority and answers 400 with the same rule.
 * A discount at or below 2% is within the agent's own authority: it needs no
 * approval and this queue refuses to record one.
 */
export function RequestDiscountButton({
  bookingId,
  bookingNumber,
}: {
  bookingId: string;
  bookingNumber: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [percent, setPercent] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const userQuery = useCurrentUser();
  const mutation = useCreateApprovalMutation();

  const role = userQuery.data?.role;
  const canRequest =
    role === "sales_agent" ||
    role === "sales_manager" ||
    role === "builder_admin" ||
    role === "admin" ||
    role === "super_admin";
  if (!canRequest) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    const parsed = CreateDiscountApprovalRequestSchema.safeParse({
      type: "discount_request",
      payload: {
        bookingId,
        requestedDiscountPercent: Number(percent),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      },
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Check the discount percentage",
      );
      return;
    }

    mutation.mutate(parsed.data, {
      onSuccess: () => {
        setDone(true);
        setPercent("");
        setReason("");
      },
      onError: (err) => setError(err.message),
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
          setDone(false);
        }}
        className="text-primary underline-offset-4 hover:underline"
      >
        Discount
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Request a discount</SheetTitle>
            <SheetDescription>
              Booking {bookingNumber}. Anything above{" "}
              {DISCOUNT_APPROVAL_THRESHOLD_PERCENT}% needs a sales manager or
              builder admin to approve it before it lands on the booking.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}
            {done ? (
              <div className="rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-xs text-chart-4">
                Request submitted — track it under Approvals.
              </div>
            ) : null}

            <div className="space-y-1">
              <label
                className="block text-[11px] uppercase tracking-wider text-muted-foreground"
                htmlFor={`discount-percent-${bookingId}`}
              >
                Discount %
              </label>
              <Input
                id={`discount-percent-${bookingId}`}
                type="number"
                step="0.01"
                min={DISCOUNT_APPROVAL_THRESHOLD_PERCENT}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>

            <div className="space-y-1">
              <label
                className="block text-[11px] uppercase tracking-wider text-muted-foreground"
                htmlFor={`discount-reason-${bookingId}`}
              >
                Reason
              </label>
              <Input
                id={`discount-reason-${bookingId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why this concession is justified"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1"
              >
                {mutation.isPending ? "Submitting…" : "Submit for approval"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
