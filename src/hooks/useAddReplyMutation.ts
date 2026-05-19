import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateReplyRequest, TicketReply } from "@/types/api";

interface AddReplyVars {
  ticketId: string;
  body: CreateReplyRequest;
}

async function addReply(vars: AddReplyVars): Promise<TicketReply> {
  const res = await fetch(
    `/api/support-tickets/${encodeURIComponent(vars.ticketId)}/replies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vars.body),
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
      "Failed to add reply";
    throw new Error(msg);
  }
  return res.json() as Promise<TicketReply>;
}

export function useAddReplyMutation() {
  const queryClient = useQueryClient();
  return useMutation<TicketReply, Error, AddReplyVars>({
    mutationFn: addReply,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["support-ticket", vars.ticketId],
      });
      void queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}
