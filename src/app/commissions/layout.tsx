import * as React from "react";
import { AppShell } from "@/components/AppShell";

/**
 * `/commissions` is reachable from the sidebar (Operations group) but lives
 * outside `/dashboard`, so it needs its own AppShell wrapper to keep the nav
 * chrome. No ChatWidget here — that stays scoped to `/dashboard/**`.
 */
export default function CommissionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
