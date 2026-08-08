"use client";

import * as React from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MAX_IMPORT_ROWS } from "@/lib/import/types";
import type { EntityImportConfig } from "@/lib/import/types";

interface ImportSourceCardProps {
  step: number;
  config: EntityImportConfig;
  csvText: string;
  fileError: string | null;
  rowCount: number;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFile: (file: File | undefined) => void;
  onText: (text: string) => void;
}

/**
 * File / paste input. Identical for every entity except the placeholder, which
 * shows that entity's minimal header line so the user can see the expected
 * column names without loading the sample.
 */
export function ImportSourceCard({
  step,
  config,
  csvText,
  fileError,
  rowCount,
  fileInputRef,
  onFile,
  onText,
}: ImportSourceCardProps) {
  const overCap = rowCount > MAX_IMPORT_ROWS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{step} · Source</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="text-xs text-muted-foreground file:mr-3 file:h-8 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-card file:px-3 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
          />
          <span className="text-[11px] text-muted-foreground">
            or paste CSV text below · max {MAX_IMPORT_ROWS} rows / 5 MB
          </span>
        </div>

        <textarea
          aria-label="CSV text"
          value={csvText}
          onChange={(e) => onText(e.target.value)}
          spellCheck={false}
          rows={6}
          placeholder={config.placeholder}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[11px] leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        />

        {fileError ? <ErrorBanner message={fileError} /> : null}
        {overCap ? (
          <ErrorBanner
            message={`This file has ${rowCount} rows. The importer accepts ${MAX_IMPORT_ROWS} at a time — split it before importing.`}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
