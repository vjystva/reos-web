"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn, inr } from "@/lib/utils";
import { unitStatusDot, unitStatusLabel } from "@/lib/unitTone";
import type { Unit } from "@/types/api";
import { UnitStatusBadge } from "@/components/UnitStatusBadge";

interface UnitTileProps {
  unit: Unit;
}

export function UnitTile({ unit }: UnitTileProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function open() {
    const next = new URLSearchParams(params.toString());
    next.set("unit", unit.id);
    router.push(`${pathname}?${next.toString()}`);
  }

  const status = (unit.status ?? "").toLowerCase();
  const bhk = typeof unit.bedrooms === "number" ? `${unit.bedrooms} BHK` : null;
  const carpet = unit.areaSqft ?? unit.area ?? null;
  const price = unit.effectivePrice ?? unit.listPrice ?? null;

  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Unit ${unit.unitNumber ?? unit.id}${
        typeof unit.floor === "number" ? `, Floor ${unit.floor}` : ""
      }${bhk ? `, ${bhk}` : ""}, ${unitStatusLabel(status)}`}
      className={cn(
        "flex min-h-[104px] flex-col items-start gap-1 rounded-md border border-border bg-card p-2 text-left transition-colors",
        "hover:border-foreground/20 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
      )}
    >
      <span className="flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums text-foreground">
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", unitStatusDot(status))}
        />
        {unit.unitNumber ?? unit.id}
      </span>

      <span className="text-[11px] text-muted-foreground">
        {typeof unit.floor === "number" ? `Flr ${unit.floor}` : "—"}
        {bhk ? ` · ${bhk}` : ""}
      </span>

      <span className="text-[11px] text-muted-foreground">
        {carpet != null ? (
          <span className="font-mono tabular-nums text-foreground">
            {carpet.toLocaleString("en-IN")}
          </span>
        ) : (
          "—"
        )}{" "}
        sqft
      </span>

      <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
        {price != null ? inr(price) : "—"}
      </span>

      <UnitStatusBadge status={unit.status} className="mt-auto" />
    </button>
  );
}
