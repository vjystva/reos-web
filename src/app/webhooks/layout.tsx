import * as React from "react";
import { MinimalShell } from "@/components/MinimalShell";

/**
 * `/webhooks` is integration/system configuration, not part of the sales ops
 * sidebar nav, so it uses the minimal shell for branding + tokens only.
 */
export default function WebhooksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MinimalShell homeHref="/webhooks">{children}</MinimalShell>;
}
