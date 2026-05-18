import { useQuery } from "@tanstack/react-query";
import type {
  CommunicationChannel,
  CommunicationTemplatesResponse,
} from "@/types/api";

export interface UseCommunicationTemplatesArgs {
  channel?: CommunicationChannel;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

async function fetchTemplates(
  args: UseCommunicationTemplatesArgs,
): Promise<CommunicationTemplatesResponse> {
  const qs = new URLSearchParams();
  if (args.channel) qs.set("channel", args.channel);
  if (args.isActive != null) qs.set("isActive", String(args.isActive));
  if (args.page != null) qs.set("page", String(args.page));
  if (args.limit != null) qs.set("limit", String(args.limit));

  const url = qs.toString()
    ? `/api/communications/templates?${qs.toString()}`
    : "/api/communications/templates";
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch templates",
    );
  }
  return res.json() as Promise<CommunicationTemplatesResponse>;
}

export function useCommunicationTemplates(
  args: UseCommunicationTemplatesArgs = {},
) {
  return useQuery<CommunicationTemplatesResponse, Error>({
    queryKey: [
      "communication-templates",
      args.channel ?? null,
      args.isActive ?? null,
      args.page ?? null,
      args.limit ?? null,
    ],
    queryFn: () => fetchTemplates(args),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
