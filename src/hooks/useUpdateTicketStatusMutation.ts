import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupportTicket, TicketStatus } from "@/types/api";

interface UpdateStatusVars {
  ticketId: string;
  status: TicketStatus;
}

async function updateStatus(vars: UpdateStatusVars): Promise<SupportTicket> {
  const res = await fetch(
    `/api/support-tickets/${encodeURIComponent(vars.ticketId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: vars.status }),
    },
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to update status";
    throw new Error(msg);
  }
  return res.json() as Promise<SupportTicket>;
}

export function useUpdateTicketStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation<SupportTicket, Error, UpdateStatusVars>({
    mutationFn: updateStatus,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["support-ticket", vars.ticketId],
      });
      void queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}
