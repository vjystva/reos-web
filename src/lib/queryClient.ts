import { QueryClient } from "@tanstack/react-query";

/**
 * Polling defaults per architecture D4:
 *   - 30s interval, suppressed in background tabs
 *   - 25s staleTime keeps remounts from double-fetching
 *   - retry: 1 — fail-fast for the poll indicator
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: 30_000,
        refetchIntervalInBackground: false,
        staleTime: 25_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
