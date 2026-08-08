"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { LeadStage } from "@/types/api";

interface ConvertLeadButtonProps {
  leadId: string;
  stage: LeadStage;
  onSuccess?: () => void;
  className?: string;
}

/**
 * "Convert to Booking".
 *
 * There is no lead->booking conversion endpoint on the backend: the leads
 * controller exposes only `:id/stage`, `:id/assign`, `:id/rescore`,
 * `:id/activities` and `:id/history` — `POST /leads/:id/convert` 404s. The
 * only real way to create a booking is `POST /bookings`
 * ({ leadId, unitId, bookingAmount? }), and the single working UI entry point
 * for that is the inventory unit-selection flow:
 *
 *   /dashboard/inventory  ->  project  ->  unit tile  ->  UnitSlideOver
 *   ->  "Book this unit"  ->  BookingForm (POST /api/bookings)
 *
 * So this button starts that flow with the lead carried on the query string.
 * `UnitSlideOver` reads `?leadId=` and hands it to `BookingForm`, which
 * pre-selects the lead — every intermediate link/filter on the inventory
 * pages rebuilds the URL from `useSearchParams()`, so the param survives
 * project selection, tower/status filters and unit selection.
 */
export function ConvertLeadButton({
  leadId,
  stage,
  onSuccess,
  className,
}: ConvertLeadButtonProps) {
  const router = useRouter();
  const isDisabled = stage === "booking" || stage === "lost";

  const handleClick = () => {
    router.push(
      `/dashboard/inventory?leadId=${encodeURIComponent(leadId)}&intent=book`,
    );
    onSuccess?.();
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={className}
      title={
        isDisabled
          ? "Booked and lost leads cannot be converted."
          : "Pick a project, then an available unit, to book for this lead"
      }
    >
      Convert to Booking
    </Button>
  );
}
