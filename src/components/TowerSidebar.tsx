"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Tower } from "@/types/api";

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
        className="w-full sm:w-48 sm:shrink-0 space-y-2"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Towers
        </h3>
        <div className="h-8 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-full animate-pulse rounded bg-slate-200" />
      </aside>
    );
  }

  if (!towers || towers.length === 0) {
    return (
      <aside
        aria-label="Towers"
        className="w-full sm:w-48 sm:shrink-0 space-y-2"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Towers
        </h3>
        <p className="text-sm text-slate-500">No towers configured.</p>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Towers"
      className="w-full sm:w-48 sm:shrink-0 space-y-2"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Towers
      </h3>
      <ul className="flex sm:block gap-2 sm:gap-0 overflow-x-auto sm:overflow-visible">
        {towers.map((t) => {
          const active = t.id === selected;
          return (
            <li key={t.id} className="sm:mb-1">
              <button
                type="button"
                onClick={() => selectTower(t.id)}
                aria-pressed={active}
                className={cn(
                  "block w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-sm",
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100",
                )}
              >
                <span className="font-medium">{t.name}</span>
                {typeof t.totalFloors === "number" ? (
                  <span
                    className={cn(
                      "block text-xs",
                      active ? "text-slate-300" : "text-slate-500",
                    )}
                  >
                    {t.totalFloors} floors
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
