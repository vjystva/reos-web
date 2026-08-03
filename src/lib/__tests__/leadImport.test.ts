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
} from "@/lib/leadImport";

const HEADERS = ["First Name", "Last Name", "Mobile", "Email"];
const MAPPING = {
  first_name: "First Name",
  last_name: "Last Name",
  phone: "Mobile",
  email: "Email",
};

function stage(rows: string[][]) {
  return stageRows(HEADERS, rows, MAPPING);
}

describe("field contract", () => {
  test("target keys match the backend's ALLOWED_HEADERS", () => {
    expect(IMPORT_FIELDS.map((f) => f.key)).toEqual([
      "first_name",
      "last_name",
      "phone",
      "email",
      "budget_min",
      "budget_max",
      "preferred_location",
      "project_interest",
      "external_ref",
    ]);
  });

  test("required fields match the backend's REQUIRED_HEADERS", () => {
    expect(REQUIRED_FIELDS).toEqual(["first_name", "last_name", "phone"]);
  });
});

describe("phoneKey", () => {
  test("reduces to the last 10 digits", () => {
    expect(phoneKey("+91 98765 43210")).toBe("9876543210");
    expect(phoneKey("9876543210")).toBe("9876543210");
  });

  test("short numbers keep all digits; empty stays empty", () => {
    expect(phoneKey("1234")).toBe("1234");
    expect(phoneKey("")).toBe("");
    expect(phoneKey(null)).toBe("");
  });
});

describe("stageRows", () => {
  test("maps values by header and numbers lines from 2", () => {
    const [row] = stage([["Rahul", "Sharma", "+91 98765 43210", "r@example.com"]]);
    expect(row.values.first_name).toBe("Rahul");
    expect(row.values.phone).toBe("+91 98765 43210");
    expect(row.lineNumber).toBe(2);
    expect(row.issues).toEqual([]);
    expect(isReady(row)).toBe(true);
  });

  test("flags missing required fields", () => {
    const [row] = stage([["", "Sharma", "", ""]]);
    expect(row.issues[0].kind).toBe("missing_required");
    expect(row.issues[0].message).toContain("First name");
    expect(row.issues[0].message).toContain("Phone");
    expect(isReady(row)).toBe(false);
  });

  test("flags an invalid phone format", () => {
    const [row] = stage([["Rahul", "Sharma", "12345", ""]]);
    expect(row.issues.map((i) => i.kind)).toContain("invalid_phone");
  });

  test("flags an invalid email but leaves a blank email alone", () => {
    const [bad] = stage([["A", "B", "9876543210", "not-an-email"]]);
    expect(bad.issues.map((i) => i.kind)).toContain("invalid_email");
    const [ok] = stage([["A", "B", "9876543210", ""]]);
    expect(ok.issues).toEqual([]);
  });

  test("flags an unparseable budget", () => {
    const rows = stageRows(
      ["first_name", "last_name", "phone", "budget_min"],
      [["A", "B", "9876543210", "abc"]],
      {
        first_name: "first_name",
        last_name: "last_name",
        phone: "phone",
        budget_min: "budget_min",
      },
    );
    expect(rows[0].issues.map((i) => i.kind)).toContain("invalid_number");
  });

  test("accepts comma-formatted budgets", () => {
    const rows = stageRows(
      ["first_name", "last_name", "phone", "budget_min"],
      [["A", "B", "9876543210", "85,00,000"]],
      {
        first_name: "first_name",
        last_name: "last_name",
        phone: "phone",
        budget_min: "budget_min",
      },
    );
    expect(rows[0].issues).toEqual([]);
  });

  test("flags an in-file duplicate on the second occurrence only", () => {
    const rows = stage([
      ["A", "One", "+91 98765 43210", ""],
      ["B", "Two", "9876543210", ""],
    ]);
    expect(rows[0].issues).toEqual([]);
    expect(rows[1].issues[0].kind).toBe("duplicate_in_file");
    expect(rows[1].issues[0].message).toContain("row 1");
    expect(isDuplicate(rows[1])).toBe(true);
  });

  test("unmapped optional columns produce empty values, not issues", () => {
    const rows = stageRows(
      ["first_name", "last_name", "phone"],
      [["A", "B", "9876543210"]],
      { first_name: "first_name", last_name: "last_name", phone: "phone" },
    );
    expect(rows[0].values.email).toBe("");
    expect(rows[0].issues).toEqual([]);
  });

  test("rows beyond the backend cap are flagged", () => {
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [
      "A",
      "B",
      `98765${String(i).padStart(5, "0")}`,
      "",
    ]);
    const rows = stage(many);
    expect(rows[MAX_IMPORT_ROWS - 1].issues).toEqual([]);
    expect(rows[MAX_IMPORT_ROWS].issues.map((i) => i.kind)).toContain(
      "over_row_cap",
    );
  });
});

describe("applyExistingMatches", () => {
  test("marks rows whose phone matches an existing lead", () => {
    const rows = stage([["Rahul", "Sharma", "+91 98765 43210", ""]]);
    const out = applyExistingMatches(
      rows,
      new Map([["9876543210", { id: "lead-9", name: "Rahul S" }]]),
    );
    expect(out[0].existing).toEqual({ id: "lead-9", name: "Rahul S" });
    expect(out[0].issues[0].kind).toBe("duplicate_existing");
    expect(out[0].issues[0].message).toBe("Duplicate of Rahul S (lead-9)");
    expect(isReady(out[0])).toBe(false);
  });

  test("is idempotent and does not mutate the input", () => {
    const rows = stage([["Rahul", "Sharma", "9876543210", ""]]);
    const matches = new Map([["9876543210", { id: "lead-9", name: "Rahul S" }]]);
    const once = applyExistingMatches(rows, matches);
    const twice = applyExistingMatches(once, matches);
    expect(twice[0].issues).toHaveLength(1);
    expect(rows[0].issues).toHaveLength(0);
  });

  test("no match leaves the row untouched", () => {
    const rows = stage([["Rahul", "Sharma", "9876543210", ""]]);
    expect(applyExistingMatches(rows, new Map())[0].issues).toEqual([]);
  });
});

describe("buildImportCsv", () => {
  test("emits the canonical backend header row", () => {
    const rows = stage([["Rahul", "Sharma", "9876543210", "r@example.com"]]);
    const { csv } = buildImportCsv(rows);
    expect(csv.split("\r\n")[0]).toBe(
      "first_name,last_name,phone,email,budget_min,budget_max,preferred_location,project_interest,external_ref",
    );
    expect(csv.split("\r\n")[1]).toBe(
      "Rahul,Sharma,9876543210,r@example.com,,,,,",
    );
  });

  test("lineNumbers maps a backend rejection back to the source line", () => {
    const rows = stage([
      ["A", "One", "9000000001", ""],
      ["", "", "", ""], // invalid — skipped
      ["C", "Three", "9000000003", ""],
    ]);
    const ready = rows.filter(isReady);
    const { lineNumbers } = buildImportCsv(ready);
    expect(lineNumbers).toEqual([2, 4]);
    // Backend rejects its data row 2 → `row` = 3 → source line 4.
    expect(lineNumbers[3 - 2]).toBe(4);
  });

  test("quotes values containing commas", () => {
    const rows = stageRows(
      ["first_name", "last_name", "phone", "preferred_location"],
      [["A", "B", "9876543210", "Bengaluru, KA"]],
      {
        first_name: "first_name",
        last_name: "last_name",
        phone: "phone",
        preferred_location: "preferred_location",
      },
    );
    expect(buildImportCsv(rows).csv).toContain('"Bengaluru, KA"');
  });
});

describe("SAMPLE_CSV", () => {
  const parsed = parseCsv(SAMPLE_CSV);
  const mapping = guessMapping(parsed.headers, IMPORT_FIELDS);

  test("auto-maps every required field", () => {
    for (const key of REQUIRED_FIELDS) expect(mapping[key]).not.toBe("");
  });

  test("stages a mix of ready, duplicate and invalid rows for the demo", () => {
    const rows = stageRows(parsed.headers, parsed.rows, mapping);
    expect(rows.length).toBe(6);
    expect(rows.filter(isReady).length).toBeGreaterThan(0);
    expect(rows.some(isDuplicate)).toBe(true);
    expect(rows.some((r) => r.issues.some((i) => i.kind === "missing_required"))).toBe(
      true,
    );
  });
});
