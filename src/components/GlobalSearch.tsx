"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill, type StatusTone } from "@/components/StatusPill";

/**
 * Global ⌘K search — extracted from `AppShell` so the topbar stays readable.
 * Behaviour is unchanged from the previous inline implementation: a debounced
 * `GET /api/search?q=…`, an outside-click-dismissed results popover, and a
 * type → route jump. The trigger now also responds to ⌘K / Ctrl-K, which the
 * `kbd` hint has always advertised.
 */

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
}

/** Where a result of each type lives. */
const RESULT_ROUTES: Record<string, string> = {
  lead: "/dashboard/pipeline",
  project: "/dashboard/inventory",
  booking: "/dashboard/bookings",
};

const RESULT_TONES: Record<string, StatusTone> = {
  lead: "info",
  project: "good",
  booking: "warn",
};

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQ, setSearchQ] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Debounced global search
  React.useEffect(() => {
    if (!searchQ || searchQ.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQ)}`);
        if (res.ok) {
          const data = (await res.json()) as { results: SearchResult[] };
          setSearchResults(data.results ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  // Close search dropdown on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ⌘K / Ctrl-K opens the popover, Esc closes it.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function goToResult(r: { id: string; type: string }) {
    router.push(RESULT_ROUTES[r.type] ?? "/dashboard");
    setSearchOpen(false);
    setSearchQ("");
  }

  return (
    <div ref={searchRef} className={cn("relative hidden sm:block", className)}>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Search"
        aria-expanded={searchOpen}
        className="flex h-8 w-52 items-center gap-2 rounded-md border border-border bg-muted/60 px-2 text-xs text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Search…</span>
        <kbd className="ml-auto font-mono text-[10px] text-muted-foreground/70">
          ⌘K
        </kbd>
      </button>

      {searchOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-96 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center border-b border-border px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search leads, projects, bookings…"
              className="h-9 flex-1 bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
            />
            {searchQ && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQ("")}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {searching && (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">Searching…</p>
            )}
            {!searching && searchQ.length >= 2 && searchResults.length === 0 && (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">
                No results for &quot;{searchQ}&quot;
              </p>
            )}
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => goToResult(r)}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                <StatusPill tone={RESULT_TONES[r.type] ?? "neutral"} className="mt-0.5 shrink-0">
                  {r.type}
                </StatusPill>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{r.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
