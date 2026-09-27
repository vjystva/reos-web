"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateApprovalMutation } from "@/hooks/useCreateApprovalMutation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CreateHoldExtensionApprovalRequestSchema } from "@/types/api";

const PRESET_MINUTES = [30, 60, 120, 240, 1440] as const;

function presetLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes === 1440) return "1 day";
  const h = minutes / 60;
  return `${h} hour${h === 1 ? "" : "s"}`;
}

/**
 * "Request extension" row action on the holds page — the entry point that feeds
 * the approvals queue with `hold_extension`s.
 *
 * Only rendered for an ACTIVE hold: the backend rejects a request against a
 * released / converted / expired hold (400), and re-checks liveness again at
 * approval time, so a hold that lapses while the request sits in the queue
 * fails the approval loudly rather than silently "extending" a dead hold.
 */
export function RequestHoldExtensionButton({
  holdId,
  unitLabel,
  expiresAt,
}: {
  holdId: string;
  unitLabel: string;
  expiresAt: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [minutes, setMinutes] = React.useState<string>("60");
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

    const parsed = CreateHoldExtensionApprovalRequestSchema.safeParse({
      type: "hold_extension",
      payload: {
        holdId,
        additionalMinutes: Number(minutes),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      },
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the extension length");
      return;
    }

    mutation.mutate(parsed.data, {
      onSuccess: () => {
        setDone(true);
        setReason("");
      },
      onError: (err) => setError(err.message),
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          setError(null);
          setDone(false);
        }}
      >
        Request extension
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Request a hold extension</SheetTitle>
            <SheetDescription>
              {unitLabel} — currently expires{" "}
              {new Date(expiresAt).toLocaleString()}. A sales manager or builder
              admin has to approve the extra time before the expiry moves.
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
                htmlFor={`hold-extension-minutes-${holdId}`}
              >
                Extra time
              </label>
              <Select
                id={`hold-extension-minutes-${holdId}`}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              >
                {PRESET_MINUTES.map((m) => (
                  <option key={m} value={String(m)}>
                    {presetLabel(m)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label
                className="block text-[11px] uppercase tracking-wider text-muted-foreground"
                htmlFor={`hold-extension-reason-${holdId}`}
              >
                Reason
              </label>
              <Input
                id={`hold-extension-reason-${holdId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. customer revisiting tomorrow"
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
