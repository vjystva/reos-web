import * as React from "react";
import { MinimalShell } from "@/components/MinimalShell";

/**
 * `/customer-portal/**` is customer-facing: it must carry reOS branding and the
 * design tokens, but never the internal ops sidebar. Brand mark links back to
 * the portal root rather than `/dashboard`, which customers cannot reach.
 */
export default function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MinimalShell homeHref="/customer-portal">{children}</MinimalShell>;
}
