import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTicketRequest, SupportTicket } from "@/types/api";

async function createTicket(
  body: CreateTicketRequest,
): Promise<SupportTicket> {
  const res = await fetch("/api/support-tickets", {
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
      "Failed to create ticket";
    throw new Error(msg);
  }
  return res.json() as Promise<SupportTicket>;
}

export function useCreateTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation<SupportTicket, Error, CreateTicketRequest>({
    mutationFn: createTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}
