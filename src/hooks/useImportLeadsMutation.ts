"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImportCsvResultSchema, type ImportCsvResult } from "@/types/api";

export interface ImportLeadsVariables {
  /** Canonical CSV text (headers must be the backend's snake_case names). */
  csv: string;
  /** Filename sent with the multipart part — cosmetic, aids server logs. */
  filename?: string;
}

async function importLeads({
  csv,
  filename = "leads.csv",
}: ImportLeadsVariables): Promise<ImportCsvResult> {
  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), filename);

  const res = await fetch("/api/leads/import", { method: "POST", body: form });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      error?: string;
    };
    const msg = Array.isArray(err.message) ? err.message.join(", ") : err.message;
    throw new Error(msg ?? err.error ?? "Import failed");
  }

  const parsed = ImportCsvResultSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error("import_shape_mismatch");
  return parsed.data;
}

/**
 * Bulk CSV lead import (`POST /api/leads/import` → backend
 * `POST /leads/import/csv`).
 *
 * Resolves with `{ imported, rejected[] }` — a partially successful import is
 * a SUCCESS, not an error: rows that failed validation come back in
 * `rejected` while the rest are committed.
 */
export function useImportLeadsMutation() {
  const qc = useQueryClient();
  return useMutation<ImportCsvResult, Error, ImportLeadsVariables>({
    mutationFn: importLeads,
    onSuccess: (result) => {
      if (result.imported > 0) {
        void qc.invalidateQueries({ queryKey: ["leads"] });
        void qc.invalidateQueries({ queryKey: ["metrics"] });
      }
    },
  });
}
