"use client";

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
import { parseCsv, guessMapping } from "@/lib/csv";
import {
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  REQUIRED_FIELDS,
  SAMPLE_CSV,
  applyExistingMatches,
  buildImportCsv,
  isDuplicate,
  isReady,
  phoneKey,
  stageRows,
  type ExistingMatch,
  type StagedRow,
} from "@/lib/leadImport";
import { useImportLeadsMutation } from "@/hooks/useImportLeadsMutation";
import {
  useDuplicateLeadCheck,
  DUPLICATE_CHECK_MAX_PROBES,
} from "@/hooks/useDuplicateLeadCheck";
import { useRoutingMode } from "@/hooks/useRoutingMode";
import { ROUTING_MODE_LABELS, type ImportCsvResult } from "@/types/api";

/** Distinct phone count under which the duplicate probe runs automatically. */
const AUTO_DUPLICATE_CHECK_LIMIT = 25;

const MAX_PREVIEW_ROWS = 200;

function formatBudget(min: string, max: string): string {
  const clean = (v: string) => v.replace(/[, ]/g, "");
  if (!clean(min) && !clean(max)) return "—";
  const fmt = (v: string) => {
    const n = Number(clean(v));
    return Number.isFinite(n) && v.trim() !== ""
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
          notation: "compact",
        }).format(n)
      : "—";
  };
  return `${fmt(min)} – ${fmt(max)}`;
}

export default function ImportLeadsPage() {
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

  const importMutation = useImportLeadsMutation();
  const dupCheck = useDuplicateLeadCheck();
  const routing = useRoutingMode();

  const parsed = React.useMemo(() => parseCsv(csvText), [csvText]);

  // Re-guess the mapping whenever a new header row appears.
  const headerSignature = React.useMemo(
    () => JSON.stringify(parsed.headers),
    [parsed.headers],
  );
  const headersRef = React.useRef(parsed.headers);
  headersRef.current = parsed.headers;
  React.useEffect(() => {
    const headers = headersRef.current;
    setMapping(headers.length > 0 ? guessMapping(headers, IMPORT_FIELDS) : {});
    setDuplicates(new Map());
    setDupChecked(false);
    setDupSkipped(0);
    setResult(null);
  }, [headerSignature]);

  const mappingSignature = IMPORT_FIELDS.map((f) => mapping[f.key] ?? "").join("|");

  const baseRows: StagedRow[] = React.useMemo(
    () => stageRows(parsed.headers, parsed.rows, mapping),
    // `mappingSignature` captures every value we read out of `mapping`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, mappingSignature],
  );

  const rows: StagedRow[] = React.useMemo(() => {
    const withDupes = applyExistingMatches(baseRows, duplicates);
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
  }, [baseRows, duplicates, result, submittedLines]);

  const readyRows = React.useMemo(() => rows.filter(isReady), [rows]);
  const duplicateCount = React.useMemo(
    () => rows.filter(isDuplicate).length,
    [rows],
  );
  const missingRequired = REQUIRED_FIELDS.filter((k) => !mapping[k]);
  const overCap = parsed.rows.length > MAX_IMPORT_ROWS;

  const distinctPhones = React.useMemo(() => {
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
  }, [baseRows]);

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

  function loadText(text: string, name: string | null) {
    setCsvText(text);
    setFileName(name);
    setFileError(null);
    autoCheckedRef.current = "";
    importMutation.reset();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFileError("File is larger than the 5 MB limit.");
      return;
    }
    try {
      loadText(await file.text(), file.name);
    } catch {
      setFileError("Could not read that file.");
    }
  }

  function handleImport() {
    const { csv, lineNumbers } = buildImportCsv(readyRows);
    setSubmittedLines(lineNumbers);
    importMutation.mutate(
      { csv, filename: fileName ?? "leads.csv" },
      { onSuccess: (res) => setResult(res) },
    );
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

  const assignmentLabel = routing.data
    ? ROUTING_MODE_LABELS[routing.data.routingMode]
    : null;

  const previewRows = rows.slice(0, MAX_PREVIEW_ROWS);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bulk CSV import"
        subtitle="Upload or paste a CSV, map the columns, review the staged rows, then import."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => loadText(SAMPLE_CSV, "sample-leads.csv")}
            >
              Load sample CSV
            </Button>
            <Button variant="ghost" onClick={reset} disabled={!csvText}>
              Clear
            </Button>
          </>
        }
      />

      {/* --- Tiles ------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard
          label="Rows parsed"
          value={parsed.rows.length}
          hint={fileName ?? (csvText ? "pasted text" : "no source yet")}
        />
        <MetricCard
          label="Ready"
          value={readyRows.length}
          hint="valid, non-duplicate"
        />
        <MetricCard
          label="Duplicates"
          value={duplicateCount}
          hint={
            dupChecked
              ? dupSkipped > 0
                ? `${dupSkipped} numbers not checked (cap ${DUPLICATE_CHECK_MAX_PROBES})`
                : "checked against existing leads"
              : "in-file only — run the check"
          }
        />
        <MetricCard
          label="Assignment mode"
          value={assignmentLabel ?? undefined}
          isLoading={routing.isLoading}
          isError={routing.isError}
          hint="owners resolved server-side per row"
        />
      </div>

      {/* --- 1. Source --------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>1 · Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file"
              onChange={(e) => void handleFile(e.target.files?.[0])}
              className="text-xs text-muted-foreground file:mr-3 file:h-8 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-card file:px-3 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
            />
            <span className="text-[11px] text-muted-foreground">
              or paste CSV text below · max {MAX_IMPORT_ROWS} rows / 5 MB
            </span>
          </div>

          <textarea
            aria-label="CSV text"
            value={csvText}
            onChange={(e) => loadText(e.target.value, null)}
            spellCheck={false}
            rows={6}
            placeholder={"first_name,last_name,phone,email\nRahul,Sharma,+91 98765 43210,rahul@example.com"}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[11px] leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          />

          {fileError ? <ErrorBanner message={fileError} /> : null}
          {overCap ? (
            <ErrorBanner
              message={`This file has ${parsed.rows.length} rows. The importer accepts ${MAX_IMPORT_ROWS} at a time — split it before importing.`}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* --- 2. Column mapping ------------------------------------------- */}
      {parsed.headers.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>2 · Column mapping</CardTitle>
            <span className="text-[11px] text-muted-foreground">
              {parsed.headers.length} column
              {parsed.headers.length === 1 ? "" : "s"} detected · auto-matched
            </span>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <label
                  htmlFor={`map-${field.key}`}
                  className="flex items-center gap-1 text-[11px] font-medium text-foreground"
                >
                  {field.label}
                  {field.required ? (
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  ) : null}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {field.key}
                  </span>
                </label>
                <Select
                  id={`map-${field.key}`}
                  value={mapping[field.key] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field.key]: e.target.value }))
                  }
                >
                  <option value="">— not mapped —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
                {field.hint ? (
                  <p className="text-[10px] text-muted-foreground">{field.hint}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* --- 3. Staged preview ------------------------------------------- */}
      {rows.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>3 · Staged preview</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {readyRows.length} of {rows.length} ready
                {rows.length > MAX_PREVIEW_ROWS
                  ? ` · showing first ${MAX_PREVIEW_ROWS}`
                  : ""}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={dupCheck.isPending || distinctPhones.length === 0}
                onClick={() => void runDuplicateCheck(distinctPhones)}
              >
                {dupCheck.isPending ? "Checking…" : "Check duplicates"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {missingRequired.length > 0 ? (
              <ErrorBanner
                message={`Map every required column before importing: ${missingRequired
                  .map((k) => IMPORT_FIELDS.find((f) => f.key === k)?.label ?? k)
                  .join(", ")}.`}
              />
            ) : null}

            <Table wrapperClassName="max-h-[28rem] overflow-y-auto">
              <TableHeader>
                <TableRow>
                  <TableHead numeric>Line</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Location / project</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row) => {
                  const name = [row.values.first_name, row.values.last_name]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <TableRow key={row.index}>
                      <TableCell numeric className="text-muted-foreground">
                        {row.lineNumber}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono">
                        {row.values.phone || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.values.email || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatBudget(row.values.budget_min, row.values.budget_max)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {[row.values.preferred_location, row.values.project_interest]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-muted-foreground"
                          title="The importer assigns each lead on the server using the tenant's routing configuration."
                        >
                          {assignmentLabel ? `Auto · ${assignmentLabel}` : "Auto"}
                        </span>
                      </TableCell>
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
                              {result && submittedLines.includes(row.lineNumber)
                                ? "Imported"
                                : "Ready"}
                            </StatusPill>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <p className="text-[11px] text-muted-foreground">
              Duplicate detection is advisory: the importer has no server-side
              dedupe, so it matches each phone number against existing leads via
              lead search before you submit. Numbers stored in a different
              format may not be found.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* --- 4. Submit ---------------------------------------------------- */}
      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5">
          <div className="text-xs text-muted-foreground">
            {result
              ? "This batch has been submitted — load another file to import more."
              : rows.length - readyRows.length > 0
                ? `${rows.length - readyRows.length} row${
                    rows.length - readyRows.length === 1 ? "" : "s"
                  } will be skipped (invalid or duplicate).`
                : "All staged rows are valid."}
          </div>
          <Button
            onClick={handleImport}
            disabled={
              readyRows.length === 0 ||
              missingRequired.length > 0 ||
              importMutation.isPending ||
              result !== null
            }
          >
            {importMutation.isPending
              ? "Importing…"
              : `Import ${readyRows.length} lead${readyRows.length === 1 ? "" : "s"}`}
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
            <p className="text-muted-foreground">
              Imported leads enter the pipeline at stage <code>new</code> with
              source <code>csv_import</code> and are assigned automatically
              {assignmentLabel ? ` (${assignmentLabel.toLowerCase()})` : ""}.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
