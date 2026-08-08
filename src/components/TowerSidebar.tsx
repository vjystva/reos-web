"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreateTowerForm } from "@/components/CreateTowerForm";
import { useCreateTowerMutation } from "@/hooks/useCreateTowerMutation";
import { cn } from "@/lib/utils";
import type { CreateTowerRequest, Tower } from "@/types/api";

const HEADING =
  "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

interface TowerSidebarProps {
  towers: Tower[];
  isLoading: boolean;
  /** When set, the sidebar is hidden (villa / plotted projects). */
  hidden?: boolean;
  /**
   * Project the towers belong to. Required to render the "+ Add tower"
   * affordance; when omitted the sidebar is read-only (back-compat with
   * callers that only list).
   */
  projectId?: string;
  /**
   * Whether the current user may create towers. The backend restricts
   * `POST /projects/:id/towers` to `builder_admin`, so this mirrors the same
   * gate the "+ Add unit" button uses.
   */
  canAddTower?: boolean;
}

export function TowerSidebar({
  towers,
  isLoading,
  hidden,
  projectId,
  canAddTower,
}: TowerSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("tower") ?? null;

  const [addOpen, setAddOpen] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const createTower = useCreateTowerMutation(projectId ?? "");
  const showAdd = Boolean(canAddTower && projectId);

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

  async function handleCreateTower(data: CreateTowerRequest) {
    setAddError(null);
    try {
      const created = await createTower.mutateAsync(data);
      setAddOpen(false);
      // Jump straight to the tower that was just created so the grid below
      // reflects it immediately (it will be empty — that is the point: the
      // user can now add units to it).
      if (created?.id) selectTower(created.id);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add tower");
    }
  }

  const addButton = showAdd ? (
    <button
      type="button"
      onClick={() => {
        setAddOpen(true);
        setAddError(null);
      }}
      className="block w-full whitespace-nowrap rounded-md border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
    >
      + Add tower
    </button>
  ) : null;

  const addSheet = showAdd ? (
    <Sheet open={addOpen} onOpenChange={setAddOpen}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add tower</SheetTitle>
          <SheetDescription>
            Towers group units in an apartment project. You need at least one
            before you can add units.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <CreateTowerForm
            idPrefix="sidebar-tower"
            isSubmitting={createTower.isPending}
            error={addError}
            onSubmit={(data) => void handleCreateTower(data)}
            onCancel={() => setAddOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  ) : null;

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
        <p className="text-xs text-muted-foreground">
          {showAdd
            ? "No towers yet. Add one to start adding units."
            : "No towers configured."}
        </p>
        {addButton}
        {addSheet}
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
        {showAdd ? <li className="sm:mb-1">{addButton}</li> : null}
      </ul>
      {addSheet}
    </aside>
  );
}
