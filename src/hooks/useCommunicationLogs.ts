import { useQuery } from "@tanstack/react-query";
import type {
  CommunicationChannel,
  CommunicationLogStatus,
  CommunicationLogsResponse,
} from "@/types/api";

export interface UseCommunicationLogsArgs {
  status?: CommunicationLogStatus;
  channel?: CommunicationChannel;
  page?: number;
  limit?: number;
}

async function fetchLogs(
  args: UseCommunicationLogsArgs,
): Promise<CommunicationLogsResponse> {
  const qs = new URLSearchParams();
  if (args.status) qs.set("status", args.status);
  if (args.channel) qs.set("channel", args.channel);
  if (args.page != null) qs.set("page", String(args.page));
  if (args.limit != null) qs.set("limit", String(args.limit));

  const url = qs.toString()
    ? `/api/communications/logs?${qs.toString()}`
    : "/api/communications/logs";
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch communication logs",
    );
  }
  return res.json() as Promise<CommunicationLogsResponse>;
}

export function useCommunicationLogs(args: UseCommunicationLogsArgs = {}) {
  return useQuery<CommunicationLogsResponse, Error>({
    queryKey: [
      "communication-logs",
      args.status ?? null,
      args.channel ?? null,
      args.page ?? null,
      args.limit ?? null,
    ],
    queryFn: () => fetchLogs(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
