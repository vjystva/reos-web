"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { IMPORT_ENTITIES } from "@/lib/import";
import type { EntityImportConfig, ImportEntityKey } from "@/lib/import/types";

interface ImportEntityPickerProps {
  value: ImportEntityKey;
  config: EntityImportConfig;
  onChange: (key: ImportEntityKey) => void;
  /** Disabled mid-import so the config cannot change under an in-flight POST. */
  disabled?: boolean;
}

/**
 * Chooses which entity the importer is targeting. Switching resets the whole
 * downstream flow (file, mapping, preview, result) — the page owns that reset;
 * this component only reports the change.
 */
export function ImportEntityPicker({
  value,
  config,
  onChange,
  disabled,
}: ImportEntityPickerProps) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-md border border-border bg-card px-3 py-2.5">
      <div className="space-y-1">
        <label
          htmlFor="import-entity"
          className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          Import type
        </label>
        <Select
          id="import-entity"
          className="w-48"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as ImportEntityKey)}
        >
          {IMPORT_ENTITIES.map((entity) => (
            <option key={entity.key} value={entity.key}>
              {entity.label}
            </option>
          ))}
        </Select>
      </div>
      <p className="max-w-2xl flex-1 pt-5 text-[11px] leading-relaxed text-muted-foreground">
        {config.description}
      </p>
    </div>
  );
}
