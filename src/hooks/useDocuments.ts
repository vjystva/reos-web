import { useQuery } from "@tanstack/react-query";
import type { DocumentResourceType, DocumentsResponse } from "@/types/api";

export interface UseDocumentsArgs {
  resourceType: DocumentResourceType;
  resourceId: string;
}

async function fetchDocuments(
  args: UseDocumentsArgs,
): Promise<DocumentsResponse> {
  const qs = new URLSearchParams();
  qs.set("resourceType", args.resourceType);
  qs.set("resourceId", args.resourceId);

  const res = await fetch(`/api/documents?${qs.toString()}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(
      (err as { error?: string }).error ?? "Failed to fetch documents",
    );
  }
  return res.json() as Promise<DocumentsResponse>;
}

export function useDocuments(args: UseDocumentsArgs) {
  const enabled = Boolean(args.resourceType && args.resourceId);
  return useQuery<DocumentsResponse, Error>({
    queryKey: ["documents", args.resourceType, args.resourceId],
    queryFn: () => fetchDocuments(args),
    enabled,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
