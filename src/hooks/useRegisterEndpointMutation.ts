import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RegisterEndpointRequest, WebhookEndpoint } from "@/types/api";

async function registerEndpoint(
  body: RegisterEndpointRequest,
): Promise<WebhookEndpoint> {
  const res = await fetch("/api/webhooks/endpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to register endpoint";
    throw new Error(msg);
  }
  return res.json() as Promise<WebhookEndpoint>;
}

export function useRegisterEndpointMutation() {
  const queryClient = useQueryClient();
  return useMutation<WebhookEndpoint, Error, RegisterEndpointRequest>({
    mutationFn: registerEndpoint,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["webhook-endpoints"] });
    },
  });
}
