import { useQuery } from "@tanstack/react-query";
import type { WebhookEndpointsResponse } from "@/types/api";

async function fetchWebhookEndpoints(): Promise<WebhookEndpointsResponse> {
  const res = await fetch("/api/webhooks/endpoints");
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch webhook endpoints",
    );
  }
  return res.json() as Promise<WebhookEndpointsResponse>;
}

export function useWebhookEndpoints() {
  return useQuery<WebhookEndpointsResponse, Error>({
    queryKey: ["webhook-endpoints"],
    queryFn: fetchWebhookEndpoints,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
