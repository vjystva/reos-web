"use client";

import * as React from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EntityImportConfig,
  ImportContext,
  StagedRow,
} from "@/lib/import/types";

export const MAX_PREVIEW_ROWS = 200;

interface ImportPreviewCardProps {
  step: number;
  config: EntityImportConfig;
  ctx: ImportContext;
  rows: StagedRow[];
  readyCount: number;
  missingRequiredLabels: string[];
  /** Line numbers actually submitted, for the Imported/Ready distinction. */
  submittedLines: number[];
  hasResult: boolean;
  /** Leads only — the advisory duplicate probe. */
  duplicateCheck?: {
    isPending: boolean;
    disabled: boolean;
    onRun: () => void;
  };
}

/**
 * Staged preview. The Line and Status columns are universal; everything
 * between them comes from `config.previewColumns(ctx)`, so each entity shows
 * the fields a human actually recognises without any copy-pasted table body.
 *
 * Server rejection reasons are rendered VERBATIM — the backend's wording
 * ("ambiguous unit: … add tower_name or use unit_id") is more actionable than
 * anything a generic prettifier could produce.
 */
export function ImportPreviewCard({
  step,
  config,
  ctx,
  rows,
  readyCount,
  missingRequiredLabels,
  submittedLines,
  hasResult,
  duplicateCheck,
}: ImportPreviewCardProps) {
  const columns = React.useMemo(
    () => config.previewColumns(ctx),
    [config, ctx],
  );
  const previewRows = rows.slice(0, MAX_PREVIEW_ROWS);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{step} · Staged preview</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {readyCount} of {rows.length} ready
            {rows.length > MAX_PREVIEW_ROWS
              ? ` · showing first ${MAX_PREVIEW_ROWS}`
              : ""}
          </span>
          {duplicateCheck ? (
            <Button
              variant="outline"
              size="sm"
              disabled={duplicateCheck.isPending || duplicateCheck.disabled}
              onClick={duplicateCheck.onRun}
            >
              {duplicateCheck.isPending ? "Checking…" : "Check duplicates"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {missingRequiredLabels.length > 0 ? (
          <ErrorBanner
            message={`Map every required column before importing: ${missingRequiredLabels.join(
              ", ",
            )}.`}
          />
        ) : null}

        <Table wrapperClassName="max-h-[28rem] overflow-y-auto">
          <TableHeader>
            <TableRow>
              <TableHead numeric>Line</TableHead>
              {columns.map((col) => (
                <TableHead key={col.header} numeric={col.numeric}>
                  {col.header}
                </TableHead>
              ))}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewRows.map((row) => (
              <TableRow key={row.index}>
                <TableCell numeric className="text-muted-foreground">
                  {row.lineNumber}
                </TableCell>
                {columns.map((col) => (
                  <TableCell
                    key={col.header}
                    numeric={col.numeric}
                    className={col.className}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {row.rejection ? (
                      <StatusPill tone="bad">
                        Rejected: {row.rejection}
                      </StatusPill>
                    ) : null}
                    {row.issues.map((issue, i) => (
                      <StatusPill
                        key={i}
                        tone={
                          issue.kind === "duplicate_existing" ||
                          issue.kind === "duplicate_in_file"
                            ? "warn"
                            : "bad"
                        }
                      >
                        {issue.message}
                      </StatusPill>
                    ))}
                    {row.issues.length === 0 && !row.rejection ? (
                      <StatusPill tone="good">
                        {hasResult && submittedLines.includes(row.lineNumber)
                          ? "Imported"
                          : "Ready"}
                      </StatusPill>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {config.previewNote ? (
          <p className="text-[11px] text-muted-foreground">
            {config.previewNote}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
