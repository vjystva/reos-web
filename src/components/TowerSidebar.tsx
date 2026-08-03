"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Tower } from "@/types/api";

const HEADING =
  "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

interface TowerSidebarProps {
  towers: Tower[];
  isLoading: boolean;
  /** When set, the sidebar is hidden (villa / plotted projects). */
  hidden?: boolean;
}

export function TowerSidebar({ towers, isLoading, hidden }: TowerSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("tower") ?? null;

  // Auto-select first tower on mount when none selected (per architecture D3 /
  // feasibility risk). Avoids the BFF dispatching to /availability for an
  // apartment project (review N3).
  React.useEffect(() => {
    if (hidden) return;
    if (isLoading) return;
    if (selected) return;
    if (!towers || towers.length === 0) return;
    const next = new URLSearchParams(params.toString());
    next.set("tower", towers[0].id);
    router.replace(`${pathname}?${next.toString()}`);
  }, [hidden, isLoading, selected, towers, params, pathname, router]);

  if (hidden) return null;

  function selectTower(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tower", id);
    // Clear the unit slide-over when switching towers.
    next.delete("unit");
    router.push(`${pathname}?${next.toString()}`);
  }

  if (isLoading) {
    return (
      <aside
        aria-label="Towers"
        className="w-full space-y-1.5 sm:w-44 sm:shrink-0"
      >
        <h3 className={HEADING}>Towers</h3>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </aside>
    );
  }

  if (!towers || towers.length === 0) {
    return (
      <aside
        aria-label="Towers"
        className="w-full space-y-1.5 sm:w-44 sm:shrink-0"
      >
        <h3 className={HEADING}>Towers</h3>
        <p className="text-xs text-muted-foreground">No towers configured.</p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Towers"
      className="w-full space-y-1.5 sm:w-44 sm:shrink-0"
    >
      <h3 className={HEADING}>Towers</h3>
      <ul className="flex gap-1.5 overflow-x-auto sm:block sm:gap-0 sm:overflow-visible">
        {towers.map((t) => {
          const active = t.id === selected;
          return (
            <li key={t.id} className="sm:mb-1">
              <button
                type="button"
                onClick={() => selectTower(t.id)}
                aria-pressed={active}
                className={cn(
                  "block w-full whitespace-nowrap rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted/60",
                )}
              >
                <span className="font-medium">{t.name}</span>
                {typeof t.totalFloors === "number" ? (
                  <span
                    className={cn(
                      "block text-[11px]",
                      active
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground",
                    )}
                  >
                    <span className="font-mono tabular-nums">
                      {t.totalFloors}
                    </span>{" "}
                    floors
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
