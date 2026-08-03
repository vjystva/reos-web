"use client";

import * as React from "react";
import { UnitTile } from "@/components/UnitTile";
import { Skeleton } from "@/components/ui/skeleton";
import type { Unit } from "@/types/api";

interface UnitGridProps {
  units: Unit[];
  isLoading: boolean;
}

export function UnitGrid({ units, isLoading }: UnitGridProps) {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading units"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6"
      >
        {Array.from({ length: 18 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] w-full" />
        ))}
      </div>
    );
  }

  if (!units || units.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
        No units match the current filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {units.map((u) => (
        <UnitTile key={u.id} unit={u} />
      ))}
    </div>
  );
}
