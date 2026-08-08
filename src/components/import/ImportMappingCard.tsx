"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EntityImportConfig, ImportFieldDef } from "@/lib/import/types";

interface ImportMappingCardProps {
  step: number;
  config: EntityImportConfig;
  headers: string[];
  mapping: Record<string, string>;
  onChange: (fieldKey: string, header: string) => void;
}

function FieldMapper({
  field,
  headers,
  value,
  onChange,
}: {
  field: ImportFieldDef;
  headers: string[];
  value: string;
  onChange: (header: string) => void;
}) {
  return (
    <div className="space-y-1">
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— not mapped —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </Select>
      {field.hint ? (
        <p className="text-[10px] text-muted-foreground">{field.hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Column mapping panel, driven entirely by `config.fields`.
 *
 * Fields flagged `advanced` (raw UUID escape hatches on the bookings importer)
 * are split into their own de-emphasised group so the primary, human-friendly
 * columns stay the obvious path — matching the backend's own stated preference
 * in `bookings-csv-import.service.ts`.
 */
export function ImportMappingCard({
  step,
  config,
  headers,
  mapping,
  onChange,
}: ImportMappingCardProps) {
  const primary = config.fields.filter((f) => !f.advanced);
  const advanced = config.fields.filter((f) => f.advanced);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{step} · Column mapping</CardTitle>
        <span className="text-[11px] text-muted-foreground">
          {headers.length} column{headers.length === 1 ? "" : "s"} detected ·
          auto-matched
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {primary.map((field) => (
            <FieldMapper
              key={field.key}
              field={field}
              headers={headers}
              value={mapping[field.key] ?? ""}
              onChange={(h) => onChange(field.key, h)}
            />
          ))}
        </div>

        {advanced.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Advanced — raw ids
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {advanced.map((field) => (
                <FieldMapper
                  key={field.key}
                  field={field}
                  headers={headers}
                  value={mapping[field.key] ?? ""}
                  onChange={(h) => onChange(field.key, h)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
