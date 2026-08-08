"use client";

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Button } from "@/components/ui/button";
import { ImportEntityPicker } from "@/components/import/ImportEntityPicker";
import { ImportProjectCard } from "@/components/import/ImportProjectCard";
import { ImportSourceCard } from "@/components/import/ImportSourceCard";
import { ImportMappingCard } from "@/components/import/ImportMappingCard";
import { ImportPreviewCard } from "@/components/import/ImportPreviewCard";
import { ImportResultCard } from "@/components/import/ImportResultCard";
import { parseCsv, guessMapping } from "@/lib/csv";
import {
  DEFAULT_IMPORT_ENTITY,
  applyExistingMatches,
  buildImportCsv,
  getImportConfig,
  isDuplicate,
  isReady,
  requiredFieldKeys,
  stageRows,
} from "@/lib/import";
import {
  MAX_IMPORT_BYTES,
  type ExistingMatch,
  type ImportContext,
  type ImportEntityKey,
  type StagedRow,
} from "@/lib/import/types";
import { phoneKey } from "@/lib/leadImport";
import { useImportEntityMutation } from "@/hooks/useImportEntityMutation";
import {
  useDuplicateLeadCheck,
  DUPLICATE_CHECK_MAX_PROBES,
} from "@/hooks/useDuplicateLeadCheck";
import { useRoutingMode } from "@/hooks/useRoutingMode";
import {
  ROUTING_MODE_LABELS,
  type ImportCsvResult,
  type Project,
  type ProjectType,
} from "@/types/api";

/**
 * Generic bulk CSV import.
 *
 * One shell, five entities. Everything entity-specific — target columns,
 * validation, sample fixture, preview columns, endpoint — lives in
 * `src/lib/import/<entity>.tsx` and is selected by the picker at the top. The
 * default is Leads, so `/dashboard/import` behaves exactly as it did when this
 * page was leads-only and existing links keep working.
 *
 * Two capabilities are genuinely leads-only and are gated rather than faked
 * for the other entities:
 *   - the duplicate PROBE against existing records (there is no dedupe
 *     endpoint; it is a phone search, and only leads have one);
 *   - the assignment-mode tile (routing rules are a lead concept).
 * Tiles that do not apply are omitted, not shown empty.
 */

/** Distinct phone count under which the duplicate probe runs automatically. */
const AUTO_DUPLICATE_CHECK_LIMIT = 25;

/** Tailwind needs literal class names, so map tile count -> grid class. */
const TILE_GRID: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export default function ImportPage() {
  const [entityKey, setEntityKey] = React.useState<ImportEntityKey>(
    DEFAULT_IMPORT_ENTITY,
  );
  const config = getImportConfig(entityKey);

  const [projectId, setProjectId] = React.useState("");
  const [projectType, setProjectType] = React.useState<ProjectType | undefined>(
    undefined,
  );

  const [csvText, setCsvText] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = React.useState<Map<string, ExistingMatch>>(
    new Map(),
  );
  const [dupSkipped, setDupSkipped] = React.useState(0);
  const [dupChecked, setDupChecked] = React.useState(false);
  const [result, setResult] = React.useState<ImportCsvResult | null>(null);
  /** submitted data-row index (1-based) → original spreadsheet line. */
  const [submittedLines, setSubmittedLines] = React.useState<number[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const routing = useRoutingMode();
  const dupCheck = useDuplicateLeadCheck();

  const assignmentLabel = routing.data
    ? ROUTING_MODE_LABELS[routing.data.routingMode]
    : null;

  const ctx: ImportContext = React.useMemo(
    () => ({ projectId, projectType, assignmentLabel }),
    [projectId, projectType, assignmentLabel],
  );

  const importMutation = useImportEntityMutation(config, ctx);

  const parsed = React.useMemo(() => parseCsv(csvText), [csvText]);

  // Re-guess the mapping whenever a new header row appears OR the target
  // entity changes (the field list, and therefore the correct mapping, is
  // entirely different per entity).
  const headerSignature = React.useMemo(
    () => JSON.stringify(parsed.headers),
    [parsed.headers],
  );
  const headersRef = React.useRef(parsed.headers);
  headersRef.current = parsed.headers;
  const fieldsRef = React.useRef(config.fields);
  fieldsRef.current = config.fields;
  React.useEffect(() => {
    const headers = headersRef.current;
    setMapping(
      headers.length > 0 ? guessMapping(headers, fieldsRef.current) : {},
    );
    setDuplicates(new Map());
    setDupChecked(false);
    setDupSkipped(0);
    setResult(null);
  }, [headerSignature, entityKey]);

  const mappingSignature = config.fields
    .map((f) => mapping[f.key] ?? "")
    .join("|");

  const baseRows: StagedRow[] = React.useMemo(
    () => stageRows(config, parsed.headers, parsed.rows, mapping, ctx),
    // `mappingSignature` captures every value we read out of `mapping`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, parsed, mappingSignature, ctx],
  );

  const rows: StagedRow[] = React.useMemo(() => {
    const withDupes = config.supportsExistingCheck
      ? applyExistingMatches(baseRows, duplicates, (v) => phoneKey(v.phone), (m) =>
          `Duplicate of ${m.name || "existing lead"} (${m.id})`,
        )
      : baseRows;
    if (!result) return withDupes;
    const byLine = new Map<number, string>();
    for (const r of result.rejected) {
      const line = submittedLines[r.row - 2];
      if (line !== undefined) byLine.set(line, r.reason);
    }
    return withDupes.map((row) =>
      byLine.has(row.lineNumber)
        ? { ...row, rejection: byLine.get(row.lineNumber) }
        : row,
    );
  }, [config, baseRows, duplicates, result, submittedLines]);

  const readyRows = React.useMemo(() => rows.filter(isReady), [rows]);
  const duplicateCount = React.useMemo(
    () => rows.filter(isDuplicate).length,
    [rows],
  );

  const missingRequired = requiredFieldKeys(config).filter((k) => !mapping[k]);
  const missingRequiredLabels = missingRequired.map(
    (k) => config.fields.find((f) => f.key === k)?.label ?? k,
  );

  const needsProject = Boolean(config.requiresProject) && !projectId;

  // --- Leads-only duplicate probe -----------------------------------------
  const distinctPhones = React.useMemo(() => {
    if (!config.supportsExistingCheck) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of baseRows) {
      const key = phoneKey(row.values.phone);
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(row.values.phone);
      }
    }
    return out;
  }, [config, baseRows]);

  const runDuplicateCheck = React.useCallback(
    async (phones: string[]) => {
      if (phones.length === 0) return;
      try {
        const res = await dupCheck.mutateAsync(phones);
        setDuplicates(res.matches);
        setDupSkipped(res.skipped);
        setDupChecked(true);
      } catch {
        setDupChecked(false);
      }
    },
    [dupCheck],
  );

  // Small files get checked automatically; large ones stay opt-in so we don't
  // fire hundreds of search requests on paste.
  const autoCheckedRef = React.useRef<string>("");
  React.useEffect(() => {
    const signature = distinctPhones.join(",");
    if (!signature || signature === autoCheckedRef.current) return;
    if (distinctPhones.length > AUTO_DUPLICATE_CHECK_LIMIT) return;
    autoCheckedRef.current = signature;
    void runDuplicateCheck(distinctPhones);
    // `runDuplicateCheck` is stable enough; re-running on identity changes would
    // loop because the mutation object is recreated on every settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distinctPhones]);

  // --- Actions -------------------------------------------------------------
  function loadText(text: string, name: string | null) {
    setCsvText(text);
    setFileName(name);
    setFileError(null);
    autoCheckedRef.current = "";
    importMutation.reset();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setFileError("File is larger than the 5 MB limit.");
      return;
    }
    try {
      loadText(await file.text(), file.name);
    } catch {
      setFileError("Could not read that file.");
    }
  }

  function reset() {
    loadText("", null);
    setDuplicates(new Map());
    setDupChecked(false);
    setDupSkipped(0);
    setResult(null);
    setSubmittedLines([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Switching entity invalidates every downstream artefact. */
  function handleEntityChange(next: ImportEntityKey) {
    if (next === entityKey) return;
    setEntityKey(next);
    setMapping({});
    setProjectId("");
    setProjectType(undefined);
    reset();
  }

  function handleProjectChange(id: string, project: Project | undefined) {
    setProjectId(id);
    setProjectType(project?.type);
    setResult(null);
    setSubmittedLines([]);
  }

  function handleImport() {
    const { csv, lineNumbers } = buildImportCsv(config, readyRows);
    setSubmittedLines(lineNumbers);
    importMutation.mutate(
      { csv, filename: fileName ?? config.uploadFileName },
      { onSuccess: (res) => setResult(res) },
    );
  }

  // --- Tiles ---------------------------------------------------------------
  // Routing rules are a lead concept; no other entity has an "assignment mode".
  const showAssignmentTile = config.key === "leads";
  const tiles: React.ReactNode[] = [
    <MetricCard
      key="parsed"
      label="Rows parsed"
      value={parsed.rows.length}
      hint={fileName ?? (csvText ? "pasted text" : "no source yet")}
    />,
    <MetricCard
      key="ready"
      label="Ready"
      value={readyRows.length}
      hint={config.dedupe ? "valid, non-duplicate" : "valid rows"}
    />,
  ];
  if (config.dedupe) {
    tiles.push(
      <MetricCard
        key="duplicates"
        label="Duplicates"
        value={duplicateCount}
        hint={
          config.supportsExistingCheck
            ? dupChecked
              ? dupSkipped > 0
                ? `${dupSkipped} numbers not checked (cap ${DUPLICATE_CHECK_MAX_PROBES})`
                : "checked against existing leads"
              : "in-file only — run the check"
            : config.dedupe.hint
        }
      />,
    );
  }
  if (showAssignmentTile) {
    tiles.push(
      <MetricCard
        key="assignment"
        label="Assignment mode"
        value={assignmentLabel ?? undefined}
        isLoading={routing.isLoading}
        isError={routing.isError}
        hint="owners resolved server-side per row"
      />,
    );
  }

  // --- Step numbering ------------------------------------------------------
  let step = 0;
  const projectStep = config.requiresProject ? ++step : 0;
  const sourceStep = ++step;
  const mappingStep = step + 1;
  const previewStep = step + 2;

  const skipped = rows.length - readyRows.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bulk CSV import"
        subtitle="Pick what you're importing, upload or paste a CSV, map the columns, review the staged rows, then import."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => loadText(config.sampleCsv, config.sampleFileName)}
            >
              Load sample CSV
            </Button>
            <Button variant="ghost" onClick={reset} disabled={!csvText}>
              Clear
            </Button>
          </>
        }
      />

      <ImportEntityPicker
        value={entityKey}
        config={config}
        onChange={handleEntityChange}
        disabled={importMutation.isPending}
      />

      <div className={`grid grid-cols-2 gap-2 ${TILE_GRID[tiles.length] ?? "lg:grid-cols-4"}`}>
        {tiles}
      </div>

      {config.requiresProject ? (
        <ImportProjectCard
          step={projectStep}
          value={projectId}
          onChange={handleProjectChange}
        />
      ) : null}

      <ImportSourceCard
        step={sourceStep}
        config={config}
        csvText={csvText}
        fileError={fileError}
        rowCount={parsed.rows.length}
        fileInputRef={fileInputRef}
        onFile={(f) => void handleFile(f)}
        onText={(t) => loadText(t, null)}
      />

      {parsed.headers.length > 0 ? (
        <ImportMappingCard
          step={mappingStep}
          config={config}
          headers={parsed.headers}
          mapping={mapping}
          onChange={(key, header) =>
            setMapping((m) => ({ ...m, [key]: header }))
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <ImportPreviewCard
          step={previewStep}
          config={config}
          ctx={ctx}
          rows={rows}
          readyCount={readyRows.length}
          missingRequiredLabels={missingRequiredLabels}
          submittedLines={submittedLines}
          hasResult={result !== null}
          duplicateCheck={
            config.supportsExistingCheck
              ? {
                  isPending: dupCheck.isPending,
                  disabled: distinctPhones.length === 0,
                  onRun: () => void runDuplicateCheck(distinctPhones),
                }
              : undefined
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
          <div className="text-xs text-muted-foreground">
            {result
              ? "This batch has been submitted — load another file to import more."
              : needsProject
                ? "Select a project above before importing units."
                : skipped > 0
                  ? `${skipped} row${skipped === 1 ? "" : "s"} will be skipped (invalid or duplicate).`
                  : "All staged rows are valid."}
          </div>
          <Button
            onClick={handleImport}
            disabled={
              readyRows.length === 0 ||
              missingRequired.length > 0 ||
              needsProject ||
              importMutation.isPending ||
              result !== null
            }
          >
            {importMutation.isPending
              ? "Importing…"
              : `Import ${readyRows.length} ${
                  readyRows.length === 1 ? config.noun.one : config.noun.many
                }`}
          </Button>
        </div>
      ) : null}

      {importMutation.isError ? (
        <ErrorBanner
          message={importMutation.error?.message ?? "Import failed."}
          onRetry={handleImport}
        />
      ) : null}

      {result ? (
        <ImportResultCard
          config={config}
          ctx={ctx}
          result={result}
          submittedLines={submittedLines}
        />
      ) : null}
    </div>
  );
}
