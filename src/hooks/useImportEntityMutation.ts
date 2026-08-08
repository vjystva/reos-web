"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImportCsvResultSchema, type ImportCsvResult } from "@/types/api";
import type { EntityImportConfig, ImportContext } from "@/lib/import/types";

/**
 * Bulk CSV import for ANY registered entity.
 *
 * Generalised from `useImportLeadsMutation` (kept in place, still used by
 * nothing but left as the documented reference for the leads-only path). The
 * five backend importers share one wire contract, so the only per-entity
 * differences are the endpoint and which query caches to invalidate — both
 * read off the `EntityImportConfig`.
 *
 * A partially successful import is a SUCCESS, not an error: rows that failed
 * validation come back in `rejected` while the rest are committed.
 */

export interface ImportEntityVariables {
  /** Canonical CSV text — headers are the backend's snake_case names. */
  csv: string;
  /** Filename sent with the multipart part — cosmetic, aids server logs. */
  filename?: string;
}

export function useImportEntityMutation(
  config: EntityImportConfig,
  ctx: ImportContext = {},
) {
  const qc = useQueryClient();
  const endpoint = config.endpoint(ctx);
  const invalidateKeys = config.invalidateKeys;

  return useMutation<ImportCsvResult, Error, ImportEntityVariables>({
    mutationFn: async ({ csv, filename }) => {
      const form = new FormData();
      form.append(
        "file",
        new Blob([csv], { type: "text/csv" }),
        filename ?? config.uploadFileName,
      );

      const res = await fetch(endpoint, { method: "POST", body: form });

      if (res.status === 401) {
        window.location.href = "/login";
        throw new Error("unauthorized");
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
          error?: string;
        };
        const msg = Array.isArray(err.message)
          ? err.message.join(", ")
          : err.message;
        throw new Error(msg ?? err.error ?? "Import failed");
      }

      const parsed = ImportCsvResultSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("import_shape_mismatch");
      return parsed.data;
    },
    onSuccess: (result) => {
      if (result.imported > 0) {
        for (const key of invalidateKeys) {
          void qc.invalidateQueries({ queryKey: [key] });
        }
      }
    },
  });
}
