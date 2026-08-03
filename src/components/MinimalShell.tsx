import * as React from "react";
import { BrandMark } from "@/components/BrandMark";

/**
 * Chrome for pages that live outside the internal ops app.
 *
 *   <div flex min-h-svh col>
 *     <header h-12>            brand mark only — no sidebar, no ops nav
 *     <div flex-1 p-4>         page content
 *
 * Same tokens and topbar geometry as `AppShell` (`sticky top-0 h-12 border-b
 * border-border bg-card px-3`, `flex-1 p-4` content well) so branding stays
 * consistent, but deliberately without the sidebar: customer-facing and
 * system-admin routes have no business rendering the internal navigation.
 *
 * Used by `/customer-portal`, `/super-admin`, `/webhooks`.
 */

interface MinimalShellProps {
  children: React.ReactNode;
  /** Where the brand mark links to. Defaults to the app root. */
  homeHref?: string;
  /** Optional right-aligned topbar slot (e.g. a sign-out button). */
  actions?: React.ReactNode;
}

export function MinimalShell({
  children,
  homeHref = "/",
  actions,
}: MinimalShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <BrandMark href={homeHref} tone="surface" />
        {actions ? (
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {actions}
          </div>
        ) : null}
      </header>

      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}
