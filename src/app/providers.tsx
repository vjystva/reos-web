"use client";

import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  // useState ensures the client is stable across renders without re-creating
  // on each render. Each browser tab gets its own client.
  const [client] = React.useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
