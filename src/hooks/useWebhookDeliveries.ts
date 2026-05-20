import { useQuery } from "@tanstack/react-query";
import type { WebhookDeliveriesResponse } from "@/types/api";

export interface UseWebhookDeliveriesArgs {
  endpointId?: string;
  status?: string;
  page?: number;
}

async function fetchWebhookDeliveries(
  args: UseWebhookDeliveriesArgs,
): Promise<WebhookDeliveriesResponse> {
  const qs = new URLSearchParams();
  if (args.endpointId) qs.set("endpointId", args.endpointId);
  if (args.status) qs.set("status", args.status);
  if (args.page != null) qs.set("page", String(args.page));

  const url = qs.toString()
    ? `/api/webhooks/deliveries?${qs.toString()}`
    : "/api/webhooks/deliveries";

  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch webhook deliveries",
    );
  }
  return res.json() as Promise<WebhookDeliveriesResponse>;
}

export function useWebhookDeliveries(args: UseWebhookDeliveriesArgs = {}) {
  return useQuery<WebhookDeliveriesResponse, Error>({
    queryKey: [
      "webhook-deliveries",
      args.endpointId ?? null,
      args.status ?? null,
      args.page ?? null,
    ],
    queryFn: () => fetchWebhookDeliveries(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
