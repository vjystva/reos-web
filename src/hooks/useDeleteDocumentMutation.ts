import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DeleteDocumentVars {
  documentId: string;
}

async function deleteDocument(vars: DeleteDocumentVars): Promise<void> {
  const res = await fetch(
    `/api/documents/${encodeURIComponent(vars.documentId)}`,
    { method: "DELETE" },
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (res.status === 403) {
    throw new Error("You do not have permission to delete this document.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to delete document";
    throw new Error(msg);
  }
}

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, DeleteDocumentVars>({
    mutationFn: deleteDocument,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({
        queryKey: ["document", vars.documentId],
      });
    },
  });
}
