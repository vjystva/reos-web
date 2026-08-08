/**
 * Units import config.
 *
 * Backend: `POST /projects/:projectId/units/import/csv`
 * (`@Roles('builder_admin')`) via BFF
 * `POST /api/projects/[projectId]/units/import`.
 *
 * Unlike every other entity this import is scoped to ONE project by URL —
 * there is deliberately no `project_id` column — so the screen makes the user
 * pick a project before mapping. See
 * `reos-backend/src/units/units-csv-import.service.ts`.
 *
 * Tower rules come from `UnitsService.create` and depend on the project's
 * type, which is why `validateRow` reads `ctx.projectType`:
 *   - apartment  -> every unit must resolve to a tower, so `tower_name` is
 *                   effectively required;
 *   - villa/plotted -> `tower_name` must be blank, else the row is rejected
 *                   with "Villa/plotted projects do not use towers".
 *
 * `tower_name` is matched by name within the project, case-insensitively. A
 * name that does not exist is a per-row rejection the client cannot predict
 * ("unknown tower_name 'X'"), so it is surfaced verbatim after submit.
 */

import type { EntityImportConfig, ImportContext, RowIssue } from "./types";
import { allOf, boolCell, enumCell, maxLenCell, numberCell } from "./validators";

/** `FACING_DIRECTIONS` in reos-backend/src/properties/project.constants.ts. */
export const FACING_DIRECTIONS = [
  "north",
  "south",
  "east",
  "west",
  "north_east",
  "north_west",
  "south_east",
  "south_west",
] as const;

/**
 * Bounds are CreateUnitDto's class-validator constraints, which the importer
 * runs per row via `validateSync` before touching the database.
 */
export const unitsImportConfig: EntityImportConfig = {
  key: "units",
  label: "Units",
  noun: { one: "unit", many: "units" },
  description:
    "Adds inventory to one project. Towers are matched by name within that project; pick the project first.",
  requiresProject: true,
  fields: [
    {
      key: "tower_name",
      label: "Tower",
      required: false,
      hint: "Required for apartment projects · must be blank for villa/plotted",
      aliases: ["tower", "block", "wing", "building"],
      validate: maxLenCell("Tower", 255),
    },
    {
      key: "unit_number",
      label: "Unit number",
      required: true,
      aliases: ["unit no", "unit", "flat no", "flat number", "apartment no"],
      validate: maxLenCell("Unit number", 50),
    },
    {
      key: "floor",
      label: "Floor",
      required: true,
      aliases: ["floor no", "level"],
      validate: numberCell("Floor", { integer: true, min: -10, max: 500 }),
    },
    {
      key: "bedrooms",
      label: "Bedrooms",
      required: true,
      aliases: ["beds", "bhk", "no of bedrooms"],
      validate: numberCell("Bedrooms", { integer: true, min: 0, max: 20 }),
    },
    {
      key: "area_sqft",
      label: "Area (sqft)",
      required: true,
      hint: "Primary chargeable area",
      aliases: ["area", "saleable area", "built up area", "sqft"],
      validate: numberCell("Area", { min: 0.01 }),
    },
    {
      key: "super_area",
      label: "Super area",
      required: false,
      aliases: ["super built up area", "super builtup"],
      validate: numberCell("Super area", { min: 0.01 }),
    },
    {
      key: "carpet_area",
      label: "Carpet area",
      required: false,
      aliases: ["rera carpet area"],
      validate: numberCell("Carpet area", { min: 0.01 }),
    },
    {
      key: "balcony_area",
      label: "Balcony area",
      required: false,
      hint: "0 is a real value (no balcony), not a blank",
      aliases: ["balcony"],
      validate: numberCell("Balcony area", { min: 0 }),
    },
    {
      key: "facing",
      label: "Facing",
      required: false,
      aliases: ["facing direction", "direction"],
      validate: enumCell("Facing", FACING_DIRECTIONS),
    },
    {
      key: "is_corner_unit",
      label: "Corner unit",
      required: false,
      aliases: ["corner", "corner unit"],
      validate: boolCell("Corner unit"),
    },
  ],
  sampleCsv: [
    "Tower,Unit No,Floor,Bedrooms,Area (sqft),Carpet Area,Balcony Area,Facing,Corner",
    "Tower A,A-1101,11,3,1450,1120,60,north_east,yes",
    "Tower A,A-1102,11,2,1120,890,45,east,no",
    "Tower A,A-1201,12,3,1450,1120,0,north_east,no",
    // Deliberately invalid: bedrooms is not a whole number.
    "Tower A,A-1202,12,three,1120,890,45,east,no",
  ].join("\n"),
  sampleFileName: "sample-units.csv",
  uploadFileName: "units.csv",
  placeholder:
    "tower_name,unit_number,floor,bedrooms,area_sqft\nTower A,A-1101,11,3,1450",
  endpoint: (ctx) =>
    `/api/projects/${encodeURIComponent(ctx.projectId ?? "")}/units/import`,
  invalidateKeys: ["units", "inventory", "projects"],
  dedupe: {
    // `unit_number` is unique per (tenant, tower), or per tenant for
    // tower-less villa/plotted inventory — so the tower is part of the key.
    key: (v) =>
      v.unit_number
        ? `${v.tower_name.toLowerCase()}|${v.unit_number.toLowerCase()}`
        : "",
    hint: "same unit number twice in this file",
    noun: "unit number",
  },
  validateRow: (values, ctx: ImportContext): RowIssue[] => {
    const issues: RowIssue[] = [];
    if (!ctx.projectType) return issues;
    if (ctx.projectType === "apartment" && !values.tower_name) {
      issues.push({
        kind: "cross_field",
        message: "Tower is required for apartment projects",
      });
    }
    if (ctx.projectType !== "apartment" && values.tower_name) {
      issues.push({
        kind: "cross_field",
        message: `Villa/plotted projects do not use towers — leave Tower blank`,
      });
    }
    return issues;
  },
  previewColumns: () => [
    {
      header: "Tower",
      className: "text-muted-foreground",
      render: (row) => row.values.tower_name || "—",
    },
    {
      header: "Unit",
      className: "font-mono font-medium text-foreground",
      render: (row) => row.values.unit_number || "—",
    },
    {
      header: "Floor",
      numeric: true,
      className: "text-muted-foreground",
      render: (row) => row.values.floor || "—",
    },
    {
      header: "Beds",
      numeric: true,
      className: "text-muted-foreground",
      render: (row) => row.values.bedrooms || "—",
    },
    {
      header: "Area",
      numeric: true,
      className: "whitespace-nowrap text-muted-foreground",
      render: (row) => (row.values.area_sqft ? `${row.values.area_sqft} sqft` : "—"),
    },
    {
      header: "Facing / corner",
      className: "text-muted-foreground",
      render: (row) =>
        [
          row.values.facing,
          row.values.is_corner_unit ? `corner: ${row.values.is_corner_unit}` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "—",
    },
  ],
  previewNote: (
    <>
      Towers are resolved by name inside the selected project, so a misspelt
      tower is only caught server-side and comes back as{" "}
      <code>unknown tower_name</code>. Unit numbers already used in the same
      tower are rejected per row, leaving the rest of the file imported.
    </>
  ),
  resultNote: () => (
    <>
      Imported units start at status <code>available</code> with an initial
      unit-status-history entry, exactly as if created one at a time.
    </>
  ),
};
