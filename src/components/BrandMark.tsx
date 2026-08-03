"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shared reOS brand block: amber square mark + wordmark, wrapped in a link home.
 *
 * Used by both shells so the mark stays identical everywhere:
 *   - `AppShell` renders it in the dark-navy sidebar header (`tone="sidebar"`)
 *   - `MinimalShell` renders it in the light `bg-card` topbar (`tone="surface"`)
 *
 * The amber square is the same in both tones — only the wordmark colour and
 * hover surface follow the tone, since they sit on different backgrounds.
 */

interface BrandMarkProps {
  /** Link target. Defaults to the internal dashboard home. */
  href?: string;
  /** Hide the wordmark (icon-collapsed sidebar rail). */
  collapsed?: boolean;
  /** Fired on click — e.g. to close the mobile sidebar sheet. */
  onNavigate?: () => void;
  /** Which surface the mark sits on. */
  tone?: "sidebar" | "surface";
  className?: string;
}

export function BrandMark({
  href = "/dashboard",
  collapsed = false,
  onNavigate,
  tone = "sidebar",
  className,
}: BrandMarkProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex h-8 items-center gap-2 overflow-hidden rounded-md px-1 outline-none transition-colors",
        tone === "sidebar"
          ? "w-full hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          // `accent` is the signature amber — far too loud for a topbar hover,
          // so the surface tone uses the neutral `muted` fill instead.
          : "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        collapsed && "justify-center px-0",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-mono text-[13px] font-bold leading-none text-sidebar-primary-foreground"
      >
        r
      </span>
      {!collapsed && (
        <span
          className={cn(
            "truncate text-sm font-bold tracking-tight",
            tone === "sidebar" ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          reOS
        </span>
      )}
    </Link>
  );
}
