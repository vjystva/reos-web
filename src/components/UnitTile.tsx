"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Unit } from "@/types/api";
import { UnitStatusBadge } from "@/components/UnitStatusBadge";

const STATUS_DOT: Record<string, string> = {
  available: "bg-green-600",
  blocked: "bg-amber-500",
  booked: "bg-blue-600",
  sold: "bg-slate-700",
  held: "bg-slate-400",
};

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
  const dot = STATUS_DOT[status] ?? "bg-slate-400";
  const bhk =
    typeof unit.bedrooms === "number" ? `${unit.bedrooms} BHK` : null;

  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Unit ${unit.unitNumber ?? unit.id}${
        typeof unit.floor === "number" ? `, Floor ${unit.floor}` : ""
      }${bhk ? `, ${bhk}` : ""}, ${status || "unknown"}`}
      className={cn(
        "flex min-h-[88px] flex-col items-start gap-1 rounded-md border border-slate-200 bg-white p-2 text-left transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <span
          aria-hidden="true"
          className={cn("h-2 w-2 rounded-full", dot)}
        />
        {unit.unitNumber ?? unit.id}
      </span>
      <span className="text-xs text-slate-500">
        {typeof unit.floor === "number" ? `Flr ${unit.floor}` : "—"}
      </span>
      {bhk ? <span className="text-xs text-slate-500">{bhk}</span> : null}
      <UnitStatusBadge status={unit.status} className="mt-auto" />
    </button>
  );
}
