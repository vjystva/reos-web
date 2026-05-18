import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CommunicationLog, SendCommunicationRequest } from "@/types/api";

async function sendCommunication(
  body: SendCommunicationRequest,
): Promise<CommunicationLog | { ok: true }> {
  const res = await fetch("/api/communications/send", {
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
      "Failed to send message";
    throw new Error(msg);
  }
  return res.json() as Promise<CommunicationLog | { ok: true }>;
}

export function useSendCommunicationMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    CommunicationLog | { ok: true },
    Error,
    SendCommunicationRequest
  >({
    mutationFn: sendCommunication,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["communication-logs"] });
    },
  });
}
