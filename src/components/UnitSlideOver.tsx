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
import {
  useUnitPriceConfig,
  PriceConfigNotFoundError,
} from "@/hooks/useUnitPriceConfig";
import { formatCurrency } from "@/lib/formatCurrency";
import type { Unit, BookingCreated } from "@/types/api";

interface UnitSlideOverProps {
  unit: Unit | null;
}

type Step = "detail" | "booking" | "success";

export function UnitSlideOver({ unit }: UnitSlideOverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [step, setStep] = React.useState<Step>("detail");
  const [createdBooking, setCreatedBooking] =
    React.useState<BookingCreated | null>(null);

  const open = Boolean(unit);
  const unitId = unit?.id ?? null;
  const priceQ = useUnitPriceConfig(open ? unitId : null);

  // Reset step when the slide-over opens for a different unit (or closes).
  React.useEffect(() => {
    setStep("detail");
    setCreatedBooking(null);
  }, [unitId]);

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

  const status = (unit.status ?? "").toLowerCase();
  const canBook = status === "available";

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
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unit details
                </h4>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-slate-500">Floor</dt>
                  <dd className="text-slate-900">
                    {typeof unit.floor === "number" ? unit.floor : "—"}
                  </dd>
                  <dt className="text-slate-500">BHK</dt>
                  <dd className="text-slate-900">
                    {typeof unit.bedrooms === "number" ? unit.bedrooms : "—"}
                  </dd>
                  <dt className="text-slate-500">Area</dt>
                  <dd className="text-slate-900">
                    {typeof unit.area === "number"
                      ? `${unit.area.toLocaleString("en-IN")} sqft`
                      : "—"}
                  </dd>
                  <dt className="text-slate-500">Facing</dt>
                  <dd className="text-slate-900">{unit.facing ?? "—"}</dd>
                  <dt className="text-slate-500">Corner unit</dt>
                  <dd className="text-slate-900">
                    {unit.isCorner === true
                      ? "Yes"
                      : unit.isCorner === false
                        ? "No"
                        : "—"}
                  </dd>
                </dl>
              </section>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pricing
                </h4>
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
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700"
                aria-hidden="true"
              >
                ✓
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  Booking created
                </p>
                <p className="text-sm font-mono text-slate-700">
                  {createdBooking.bookingNumber ?? createdBooking.id}
                </p>
              </div>
              <p className="text-sm text-slate-600">
                Unit {unit.unitNumber ?? unit.id} is now blocked
                {createdBooking.leadId ? "." : "."}
              </p>
              <p className="text-xs text-slate-500">
                Amount: {formatCurrency(defaultAmount)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-3 border-t border-slate-200 pt-3">
          {step === "detail" ? (
            canBook ? (
              <Button onClick={() => setStep("booking")} className="w-full">
                Book this unit
              </Button>
            ) : (
              <p className="text-center text-xs text-slate-500">
                This unit is not available for booking.
              </p>
            )
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
