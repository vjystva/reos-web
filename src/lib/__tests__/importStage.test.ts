/**
 * Unit cover for the generic import engine (`src/lib/import/`).
 *
 * `leadImport.test.ts` still covers the original leads-only module, which is
 * untouched. This file covers the shell that now drives all five entities:
 * the staging rules, the canonical CSV writer, and — most importantly — a
 * per-entity contract check that each config's sample fixture still
 * auto-maps and stages the way its module claims.
 *
 * The sample-fixture tests are the drift alarm: if someone edits a sample CSV
 * or an alias list and quietly breaks auto-mapping, the "Load sample CSV"
 * button silently degrades and nothing else would catch it.
 */

import { parseCsv, guessMapping } from "@/lib/csv";
import {
  IMPORT_ENTITIES,
  DEFAULT_IMPORT_ENTITY,
  applyExistingMatches,
  buildImportCsv,
  getImportConfig,
  isDuplicate,
  isReady,
  requiredFieldKeys,
  stageRows,
} from "@/lib/import";
import type {
  EntityImportConfig,
  ImportContext,
  StagedRow,
} from "@/lib/import/types";

/** Parse + auto-map + stage, the way the page does it. */
function stageFixture(
  config: EntityImportConfig,
  csv: string,
  ctx: ImportContext = {},
): { rows: StagedRow[]; mapping: Record<string, string> } {
  const parsed = parseCsv(csv);
  const mapping = guessMapping(parsed.headers, config.fields);
  return {
    rows: stageRows(config, parsed.headers, parsed.rows, mapping, ctx),
    mapping,
  };
}

describe("import registry", () => {
  test("leads is the default so /dashboard/import is unchanged for existing links", () => {
    expect(DEFAULT_IMPORT_ENTITY).toBe("leads");
    expect(IMPORT_ENTITIES[0].key).toBe("leads");
  });

  test("every entity is retrievable and has a unique key", () => {
    const keys = IMPORT_ENTITIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(getImportConfig(key).key).toBe(key);
  });

  test("every config declares at least one required field and a real endpoint", () => {
    for (const config of IMPORT_ENTITIES) {
      expect(requiredFieldKeys(config).length).toBeGreaterThan(0);
      const endpoint = config.endpoint({ projectId: "PID" });
      expect(endpoint.startsWith("/api/")).toBe(true);
      expect(config.invalidateKeys.length).toBeGreaterThan(0);
    }
  });

  test("units is the only project-scoped importer, and puts the id in its path", () => {
    const scoped = IMPORT_ENTITIES.filter((c) => c.requiresProject);
    expect(scoped.map((c) => c.key)).toEqual(["units"]);
    expect(getImportConfig("units").endpoint({ projectId: "abc-123" })).toBe(
      "/api/projects/abc-123/units/import",
    );
  });

  test("leads is the only entity offering the existing-record probe", () => {
    const probing = IMPORT_ENTITIES.filter((c) => c.supportsExistingCheck);
    expect(probing.map((c) => c.key)).toEqual(["leads"]);
  });

  test("field keys are snake_case — they are the literal backend headers", () => {
    for (const config of IMPORT_ENTITIES) {
      for (const field of config.fields) {
        expect(field.key).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });
});

describe("stageRows", () => {
  const config = getImportConfig("dealers");

  test("groups every missing required cell into one issue", () => {
    const { rows } = stageFixture(config, "name,email\n,\n");
    expect(rows[0].issues[0]).toEqual({
      kind: "missing_required",
      message: "Missing Name / Email",
    });
  });

  test("skips validators for blank optional cells", () => {
    const { rows } = stageFixture(
      config,
      "name,email,commission_rate\nA,a@b.com,\n",
    );
    expect(isReady(rows[0])).toBe(true);
  });

  test("runs validators for non-blank cells and reports the rule that failed", () => {
    const { rows } = stageFixture(
      config,
      "name,email,commission_rate\nA,a@b.com,250\n",
    );
    expect(rows[0].issues.map((i) => i.message)).toContain(
      "Commission rate must be at most 100",
    );
  });

  test("flags in-file duplicates against the FIRST occurrence, not the previous one", () => {
    const { rows } = stageFixture(
      config,
      [
        "name,email",
        "A,dup@example.com",
        "B,other@example.com",
        "C,DUP@example.com",
      ].join("\n"),
    );
    expect(isDuplicate(rows[0])).toBe(false);
    expect(isDuplicate(rows[1])).toBe(false);
    // Row 1 is the first occurrence; the message is 1-indexed over data rows.
    expect(rows[2].issues.map((i) => i.message)).toContain(
      "Duplicate email of row 1 in this file",
    );
  });

  test("an unmapped column yields blank values rather than throwing", () => {
    const parsed = parseCsv("name,email\nA,a@b.com");
    const rows = stageRows(config, parsed.headers, parsed.rows, {});
    expect(rows[0].values.name).toBe("");
    expect(isReady(rows[0])).toBe(false);
  });

  test("lineNumber is the spreadsheet line, with the header as line 1", () => {
    const { rows } = stageFixture(config, "name,email\nA,a@b.com\nB,b@b.com");
    expect(rows.map((r) => r.lineNumber)).toEqual([2, 3]);
  });
});

describe("buildImportCsv", () => {
  test("emits every field key as a header, mapped or not", () => {
    const config = getImportConfig("bookings");
    const { rows } = stageFixture(
      config,
      "lead_phone,unit_number,project_name,booking_amount\n+919000000001,A-1,Sky,100\n",
    );
    const { csv, lineNumbers } = buildImportCsv(config, rows.filter(isReady));
    const header = csv.split("\r\n")[0];

    expect(header).toBe(config.fields.map((f) => f.key).join(","));
    // The reference-group headers must be present even when unmapped — the
    // backend 400s the whole file if a whole group is missing.
    expect(header).toContain("lead_id");
    expect(header).toContain("unit_id");
    expect(lineNumbers).toEqual([2]);
  });

  test("submits only the rows handed to it, preserving source line numbers", () => {
    const config = getImportConfig("tasks");
    const { rows } = stageFixture(
      config,
      ["title,due_date", "Good,2026-01-01", "Bad,not-a-date", "Also good,"].join(
        "\n",
      ),
    );
    const ready = rows.filter(isReady);
    const { csv, lineNumbers } = buildImportCsv(config, ready);

    expect(lineNumbers).toEqual([2, 4]);
    expect(csv).not.toContain("not-a-date");
    expect(csv.split("\r\n")).toHaveLength(3); // header + 2 rows
  });
});

describe("applyExistingMatches", () => {
  const config = getImportConfig("dealers");

  test("is a no-op when the probe found nothing", () => {
    const { rows } = stageFixture(config, "name,email\nA,a@b.com");
    expect(applyExistingMatches(rows, new Map(), (v) => v.email)).toBe(rows);
  });

  test("adds one duplicate_existing issue and never mutates the input", () => {
    const { rows } = stageFixture(config, "name,email\nA,a@b.com");
    const matches = new Map([["a@b.com", { id: "d-1", name: "Existing" }]]);
    const out = applyExistingMatches(rows, matches, (v) => v.email);

    expect(rows[0].issues).toHaveLength(0);
    expect(out[0].existing).toEqual({ id: "d-1", name: "Existing" });
    expect(isDuplicate(out[0])).toBe(true);
    // Re-applying must not stack duplicates.
    const twice = applyExistingMatches(out, matches, (v) => v.email);
    expect(
      twice[0].issues.filter((i) => i.kind === "duplicate_existing"),
    ).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------------------
 * Sample fixtures — each config promises "Load sample CSV" produces a file
 * that auto-maps cleanly and contains exactly one deliberately bad row.
 * ------------------------------------------------------------------------ */
describe("sample CSV fixtures", () => {
  test.each([
    ["leads", {}, 6, 4],
    // Units are staged against an apartment project, where towers are required.
    ["units", { projectType: "apartment" as const }, 4, 3],
    ["dealers", {}, 4, 3],
    ["bookings", {}, 3, 2],
    ["tasks", {}, 4, 3],
  ])(
    "%s: sample parses to %i rows with %i ready",
    (key, ctx, expectedRows, expectedReady) => {
      const config = getImportConfig(key as EntityImportConfig["key"]);
      const { rows } = stageFixture(config, config.sampleCsv, ctx);

      expect(rows).toHaveLength(expectedRows as number);
      expect(rows.filter(isReady)).toHaveLength(expectedReady as number);
    },
  );

  test.each(IMPORT_ENTITIES.map((c) => [c.key, c] as const))(
    "%s: auto-mapping resolves every required column from the sample headers",
    (_key, config) => {
      const { mapping } = stageFixture(config, config.sampleCsv);
      for (const key of requiredFieldKeys(config)) {
        expect(mapping[key]).toBeTruthy();
      }
    },
  );

  test("units sample flips from mostly-valid to all-invalid on a villa project", () => {
    const config = getImportConfig("units");
    const apartment = stageFixture(config, config.sampleCsv, {
      projectType: "apartment",
    });
    const villa = stageFixture(config, config.sampleCsv, {
      projectType: "villa",
    });

    expect(apartment.rows.filter(isReady)).toHaveLength(3);
    // Every sample row names a tower, which villa/plotted projects forbid.
    expect(villa.rows.filter(isReady)).toHaveLength(0);
  });

  test("bookings sample flags the row whose unit number has no project", () => {
    const config = getImportConfig("bookings");
    const { rows } = stageFixture(config, config.sampleCsv);
    expect(rows[2].issues.map((i) => i.message)).toContain(
      "Project name is required when matching by unit number",
    );
  });
});
