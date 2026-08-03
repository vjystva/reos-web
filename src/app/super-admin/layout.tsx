import * as React from "react";
import { MinimalShell } from "@/components/MinimalShell";

/**
 * `/super-admin` is cross-tenant platform administration — it sits outside any
 * single tenant's ops app, so it gets the minimal shell rather than `AppShell`'s
 * tenant-scoped sidebar nav.
 */
export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MinimalShell homeHref="/super-admin">{children}</MinimalShell>;
}
