"use client";

import * as React from "react";
import { StatusPill } from "@/components/StatusPill";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EntityImportConfig, ImportContext } from "@/lib/import/types";
import type { ImportCsvResult } from "@/types/api";

interface ImportResultCardProps {
  config: EntityImportConfig;
  ctx: ImportContext;
  result: ImportCsvResult;
  /** submitted data-row index (1-based) → original spreadsheet line. */
  submittedLines: number[];
}

/**
 * Post-submit summary.
 *
 * Rejection reasons are printed exactly as the backend worded them and mapped
 * back to the ORIGINAL spreadsheet line — the submitted file only contains the
 * ready rows, so `rejected[].row` is an index into that filtered file, not
 * into what the user is looking at.
 */
export function ImportResultCard({
  config,
  ctx,
  result,
  submittedLines,
}: ImportResultCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={result.imported > 0 ? "good" : "warn"}>
            {result.imported} imported
          </StatusPill>
          {result.rejected.length > 0 ? (
            <StatusPill tone="bad">
              {result.rejected.length} rejected by the server
            </StatusPill>
          ) : null}
        </div>
        {result.rejected.length > 0 ? (
          <ul className="space-y-0.5 text-muted-foreground">
            {result.rejected.map((r) => (
              <li key={r.row}>
                Line {submittedLines[r.row - 2] ?? r.row}: {r.reason}
              </li>
            ))}
          </ul>
        ) : null}
        {config.resultNote ? (
          <p className="text-muted-foreground">{config.resultNote(ctx)}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
