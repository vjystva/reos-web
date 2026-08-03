"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectRequest, Project } from "@/types/api";

async function createProject(body: CreateProjectRequest): Promise<Project> {
  const res = await fetch("/api/projects", {
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
      "Failed to create project";
    throw new Error(msg);
  }
  return res.json() as Promise<Project>;
}

export function useCreateProjectMutation() {
  const qc = useQueryClient();
  return useMutation<Project, Error, CreateProjectRequest>({
    mutationFn: createProject,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
