import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CommunicationTemplate, CreateTemplateRequest } from "@/types/api";

async function createTemplate(
  body: CreateTemplateRequest,
): Promise<CommunicationTemplate> {
  const res = await fetch("/api/communications/templates", {
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
      "Failed to create template";
    throw new Error(msg);
  }
  return res.json() as Promise<CommunicationTemplate>;
}

export function useCreateTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation<CommunicationTemplate, Error, CreateTemplateRequest>({
    mutationFn: createTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["communication-templates"],
      });
    },
  });
}
