import { useMutation, useQueryClient } from "@tanstack/react-query";

interface DeleteTemplateVars {
  id: string;
}

async function deleteTemplate(vars: DeleteTemplateVars): Promise<void> {
  const res = await fetch(
    `/api/communications/templates/${encodeURIComponent(vars.id)}`,
    { method: "DELETE" },
  );
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (res.status === 403) {
    throw new Error("You do not have permission to delete this template.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    const msg =
      (err as { message?: string; error?: string }).message ??
      (err as { error?: string }).error ??
      "Failed to delete template";
    throw new Error(msg);
  }
}

export function useDeleteTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, DeleteTemplateVars>({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["communication-templates"],
      });
    },
  });
}
