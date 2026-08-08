"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { UnitStatusBadge } from "@/components/UnitStatusBadge";
import {
  PricingBreakdownTable,
  PricingBreakdownFallback,
} from "@/components/PricingBreakdownTable";
import { BookingForm } from "@/components/BookingForm";
import { Select } from "@/components/ui/select";
import {
  useUnitPriceConfig,
  PriceConfigNotFoundError,
} from "@/hooks/useUnitPriceConfig";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUpdateUnitStatusMutation } from "@/hooks/useUpdateUnitStatusMutation";
import {
  availableTransitions,
  requiresNote,
} from "@/lib/unitTransitions";
import { unitStatusLabel } from "@/lib/unitTone";
import { inr } from "@/lib/utils";
import type { Unit, BookingCreated, UnitStatus } from "@/types/api";

/** Dense section heading recipe, shared across the inventory surfaces. */
const SECTION_HEADING =
  "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

interface UnitSlideOverProps {
  unit: Unit | null;
  /** Project the unit belongs to; falls back to the unit's own projectId. */
  projectId?: string;
}

type Step = "detail" | "booking" | "success";

export function UnitSlideOver({ unit, projectId }: UnitSlideOverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [step, setStep] = React.useState<Step>("detail");
  const [createdBooking, setCreatedBooking] =
    React.useState<BookingCreated | null>(null);
  const [targetStatus, setTargetStatus] = React.useState("");
  const [note, setNote] = React.useState("");
  const [statusError, setStatusError] = React.useState<string | null>(null);

  const open = Boolean(unit);
  const unitId = unit?.id ?? null;
  /**
   * Set when the user arrived from a lead's "Convert to Booking"
   * (`/dashboard/inventory?leadId=…`). Every inventory link rebuilds the query
   * string from `useSearchParams()`, so the param survives the walk down to
   * the unit and lands here to pre-select the lead in `BookingForm`.
   */
  const presetLeadId = params.get("leadId");
  const priceQ = useUnitPriceConfig(open ? unitId : null);

  const { data: currentUser } = useCurrentUser();
  const effectiveProjectId = projectId ?? unit?.projectId ?? "";
  const statusMutation = useUpdateUnitStatusMutation(
    effectiveProjectId,
    unit?.id ?? "",
  );

  const unitStatus = (unit?.status ?? "").toLowerCase();

  // Reset step + status form when the slide-over opens for a different unit.
  // When the user is mid-conversion for a specific lead and the unit is
  // available, jump straight to the booking step — that is the whole point of
  // the flow they started on the lead page.
  React.useEffect(() => {
    setStep(presetLeadId && unitStatus === "available" ? "booking" : "detail");
    setCreatedBooking(null);
    setTargetStatus("");
    setNote("");
    setStatusError(null);
  }, [unitId, presetLeadId, unitStatus]);

  const transitions = availableTransitions(unit?.status, currentUser?.role);
  const noteRequired = targetStatus ? requiresNote(targetStatus) : false;

  async function handleStatusChange() {
    if (!targetStatus) return;
    setStatusError(null);
    try {
      await statusMutation.mutateAsync({
        toStatus: targetStatus as UnitStatus,
        note: note.trim() ? note.trim() : undefined,
      });
      setTargetStatus("");
      setNote("");
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Failed to update status",
      );
    }
  }

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("unit");
    router.push(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }

  if (!unit) {
    return (
      <Sheet open={false} onOpenChange={() => {}}>
        <SheetContent aria-label="Unit detail" />
      </Sheet>
    );
  }

  const canBook = unitStatus === "available";
  /**
   * `area`/`areaSqft` is `units.area_sqft` — the chargeable area. It is NOT
   * the carpet area; carpet is its own column since backend migration 033.
   * Kept as the headline figure, with the optional breakdown below it.
   */
  const chargeableArea = unit.areaSqft ?? unit.area ?? null;

  /**
   * Only the figures the builder actually captured are shown. `balconyArea`
   * of 0 is a real value ("no balcony"), so this filters on
   * `typeof === "number"`, never on truthiness.
   */
  const areaBreakdown: { label: string; value: number }[] = [
    { label: "Super area", value: unit.superArea },
    { label: "Carpet area", value: unit.carpetArea },
    { label: "Balcony area", value: unit.balconyArea },
  ].flatMap((row) =>
    typeof row.value === "number" ? [{ label: row.label, value: row.value }] : [],
  );

  function sqft(n: number) {
    return (
      <>
        <span className="font-mono tabular-nums">
          {n.toLocaleString("en-IN")}
        </span>{" "}
        sqft
      </>
    );
  }

  const headerTitle =
    step === "booking"
      ? `Book ${unit.unitNumber ?? unit.id}`
      : step === "success"
        ? "Booking created"
        : (unit.unitNumber ?? unit.id);

  const priceConfigUnavailable =
    priceQ.error instanceof PriceConfigNotFoundError;

  const defaultAmount =
    priceQ.data?.effectivePrice ?? unit.effectivePrice ?? 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        aria-label={`Unit ${unit.unitNumber ?? unit.id} detail`}
        className="flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>{headerTitle}</SheetTitle>
          {step === "detail" ? (
            <SheetDescription>
              <span className="inline-flex items-center gap-2">
                <UnitStatusBadge status={unit.status} />
              </span>
            </SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto pt-2">
          {step === "detail" ? (
            <>
              <section>
                <h4 className={SECTION_HEADING}>Unit details</h4>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Floor</dt>
                  <dd className="font-mono tabular-nums text-foreground">
                    {typeof unit.floor === "number" ? unit.floor : "—"}
                  </dd>
                  <dt className="text-muted-foreground">BHK</dt>
                  <dd className="font-mono tabular-nums text-foreground">
                    {typeof unit.bedrooms === "number" ? unit.bedrooms : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Area</dt>
                  <dd className="text-foreground">
                    {typeof chargeableArea === "number"
                      ? sqft(chargeableArea)
                      : "—"}
                  </dd>
                  {areaBreakdown.map((row) => (
                    <React.Fragment key={row.label}>
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="text-foreground">{sqft(row.value)}</dd>
                    </React.Fragment>
                  ))}
                  <dt className="text-muted-foreground">Facing</dt>
                  <dd className="capitalize text-foreground">
                    {unit.facing ? unit.facing.replace(/_/g, " ") : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Corner unit</dt>
                  <dd className="text-foreground">
                    {unit.isCorner === true
                      ? "Yes"
                      : unit.isCorner === false
                        ? "No"
                        : "—"}
                  </dd>
                </dl>
              </section>

              <section>
                <h4 className={SECTION_HEADING}>Pricing</h4>
                <div className="mt-2">
                  {priceQ.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-5 w-full" />
                      ))}
                    </div>
                  ) : priceConfigUnavailable ? (
                    <PricingBreakdownFallback
                      effectivePrice={unit.effectivePrice ?? null}
                    />
                  ) : priceQ.isError ? (
                    <ErrorBanner
                      message="Could not load pricing."
                      onRetry={() => priceQ.refetch()}
                    />
                  ) : priceQ.data ? (
                    <PricingBreakdownTable config={priceQ.data} />
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          {step === "booking" ? (
            <BookingForm
              unitId={unit.id}
              unitNumber={unit.unitNumber ?? unit.id}
              defaultAmount={defaultAmount}
              presetLeadId={presetLeadId}
              onCancel={() => setStep("detail")}
              onSuccess={(booking) => {
                setCreatedBooking(booking);
                setStep("success");
              }}
            />
          ) : null}

          {step === "success" && createdBooking ? (
            <div className="space-y-3 text-center">
              <div
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-chart-4/15 text-lg text-chart-4"
                aria-hidden="true"
              >
                ✓
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Booking created
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {createdBooking.bookingNumber ?? createdBooking.id}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Unit {unit.unitNumber ?? unit.id} is now blocked.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Amount:{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {inr(defaultAmount)}
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {step === "detail" ? (
            <>
              {canBook ? (
                <Button onClick={() => setStep("booking")} className="w-full">
                  Book this unit
                </Button>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground">
                  This unit is not available for booking.
                </p>
              )}

              {transitions.length > 0 ? (
                <div className="space-y-2">
                  <label className={SECTION_HEADING} htmlFor="unit-status-change">
                    Change status
                  </label>
                  <Select
                    id="unit-status-change"
                    value={targetStatus}
                    onChange={(e) => {
                      setTargetStatus(e.target.value);
                      setStatusError(null);
                    }}
                    aria-label="Change unit status"
                  >
                    <option value="">Select new status…</option>
                    {transitions.map((t) => (
                      <option key={t} value={t}>
                        {unitStatusLabel(t)}
                      </option>
                    ))}
                  </Select>

                  {noteRequired ? (
                    <div className="space-y-1">
                      <label
                        className="block text-[11px] uppercase tracking-wider text-muted-foreground"
                        htmlFor="unit-status-note"
                      >
                        Note (required)
                      </label>
                      <textarea
                        id="unit-status-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        maxLength={1000}
                        className="block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                        placeholder="Reason for this change…"
                      />
                    </div>
                  ) : null}

                  {statusError ? (
                    <ErrorBanner message={statusError} />
                  ) : null}

                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={
                      !targetStatus ||
                      statusMutation.isPending ||
                      (noteRequired && !note.trim())
                    }
                    onClick={() => void handleStatusChange()}
                  >
                    {statusMutation.isPending ? "Updating…" : "Update status"}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
          {step === "success" ? (
            <Button onClick={close} variant="outline" className="w-full">
              Close
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
