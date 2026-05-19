import { useQuery } from "@tanstack/react-query";
import type {
  SupportTicketsResponse,
  TicketPriority,
  TicketStatus,
} from "@/types/api";

export interface UseSupportTicketsArgs {
  status?: TicketStatus;
  priority?: TicketPriority;
  page?: number;
  limit?: number;
}

async function fetchTickets(
  args: UseSupportTicketsArgs,
): Promise<SupportTicketsResponse> {
  const qs = new URLSearchParams();
  if (args.status) qs.set("status", args.status);
  if (args.priority) qs.set("priority", args.priority);
  if (args.page != null) qs.set("page", String(args.page));
  if (args.limit != null) qs.set("limit", String(args.limit));

  const url = qs.toString()
    ? `/api/support-tickets?${qs.toString()}`
    : "/api/support-tickets";
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch tickets",
    );
  }
  return res.json() as Promise<SupportTicketsResponse>;
}

export function useSupportTickets(args: UseSupportTicketsArgs = {}) {
  return useQuery<SupportTicketsResponse, Error>({
    queryKey: [
      "support-tickets",
      args.status ?? null,
      args.priority ?? null,
      args.page ?? null,
      args.limit ?? null,
    ],
    queryFn: () => fetchTickets(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
