/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import ImportLeadsPage from "@/app/dashboard/import/page";

const importMutate = jest.fn();
const importReset = jest.fn();
const dupMutateAsync = jest.fn(async () => ({
  matches: new Map<string, { id: string; name: string }>(),
  checked: 0,
  skipped: 0,
}));

/**
 * The page moved from the leads-only `useImportLeadsMutation` to the
 * config-driven `useImportEntityMutation` when the screen became generic.
 * `lastImportConfig` captures which entity config the page handed the hook, so
 * the entity-switch tests can assert the endpoint/target actually changed
 * rather than only that the UI relabelled itself.
 */
let lastImportConfig: { key: string; endpoint: (ctx: unknown) => string } | null =
  null;

jest.mock("@/hooks/useImportEntityMutation", () => ({
  useImportEntityMutation: (config: {
    key: string;
    endpoint: (ctx: unknown) => string;
  }) => {
    lastImportConfig = config;
    return {
      mutate: importMutate,
      reset: importReset,
      isPending: false,
      isError: false,
      error: null,
    };
  },
}));

jest.mock("@/hooks/useDuplicateLeadCheck", () => ({
  useDuplicateLeadCheck: () => ({ mutateAsync: dupMutateAsync, isPending: false }),
  DUPLICATE_CHECK_MAX_PROBES: 100,
}));

jest.mock("@/hooks/useRoutingMode", () => ({
  useRoutingMode: () => ({
    data: { routingMode: "round_robin" },
    isLoading: false,
    isError: false,
  }),
}));

jest.mock("@/hooks/useProjects", () => ({
  useProjects: () => ({
    data: {
      data: [
        { id: "p-apartment", name: "Skyline Heights", type: "apartment" },
        { id: "p-villa", name: "Green Valley Villas", type: "villa" },
      ],
      total: 2,
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

/** Switches the entity picker and lets the reset effects settle. */
async function selectEntity(key: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(/import type/i), {
    target: { value: key },
  });
  await act(async () => {
    await Promise.resolve();
  });
}

/** Lets the auto-fired duplicate probe settle inside act(). */
async function flushAutoDuplicateCheck(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function tile(label: string): HTMLElement {
  const el = screen.getByLabelText(new RegExp(`^${label}:`, "i"));
  return el;
}

describe("Bulk CSV import page", () => {
  beforeEach(() => {
    importMutate.mockClear();
    dupMutateAsync.mockClear();
    lastImportConfig = null;
  });

  test("renders the empty state with zeroed tiles and no preview", () => {
    render(<ImportLeadsPage />);
    expect(
      screen.getByRole("heading", { name: /bulk csv import/i }),
    ).toBeInTheDocument();
    // Leads is the default entity, so the leads-only URL keeps working.
    expect(screen.getByLabelText(/import type/i)).toHaveValue("leads");
    expect(lastImportConfig?.key).toBe("leads");
    expect(tile("Rows parsed")).toHaveTextContent("0");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/csv file/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/csv text/i)).toBeInTheDocument();
  });

  test("Load sample CSV parses rows, auto-maps columns and stages a preview", async () => {
    render(<ImportLeadsPage />);
    fireEvent.click(screen.getByRole("button", { name: /load sample csv/i }));
    await flushAutoDuplicateCheck();

    expect(tile("Rows parsed")).toHaveTextContent("6");
    // 6 rows − 1 in-file duplicate − 1 missing last name = 4 ready.
    expect(tile("Ready")).toHaveTextContent("4");
    expect(tile("Duplicates")).toHaveTextContent("1");
    expect(tile("Assignment mode")).toHaveTextContent("Round robin");

    // Auto-guessed mapping: "First Name" → first_name, "Mobile Number" → phone.
    expect(screen.getByLabelText(/first name/i)).toHaveValue("First Name");
    expect(screen.getByLabelText(/^phone/i)).toHaveValue("Mobile Number");
    expect(screen.getByLabelText(/preferred location/i)).toHaveValue("Locality");
    expect(screen.getByLabelText(/external ref/i)).toHaveValue("CRM Ref");

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(7); // header + 6 data rows
    expect(rows[1]).toHaveTextContent("Rahul Sharma");
    expect(rows[1]).toHaveTextContent("Auto · Round robin");
    expect(rows[5]).toHaveTextContent(/duplicate of row 4/i);
    expect(rows[6]).toHaveTextContent(/missing last name/i);
  });

  test("submits only the ready rows as canonical CSV", async () => {
    render(<ImportLeadsPage />);
    fireEvent.click(screen.getByRole("button", { name: /load sample csv/i }));
    await flushAutoDuplicateCheck();

    const submit = screen.getByRole("button", { name: /import 4 leads/i });
    fireEvent.click(submit);

    expect(importMutate).toHaveBeenCalledTimes(1);
    const [vars] = importMutate.mock.calls[0] as [{ csv: string }];
    const lines = vars.csv.split("\r\n");
    expect(lines[0]).toBe(
      "first_name,last_name,phone,email,budget_min,budget_max,preferred_location,project_interest,external_ref",
    );
    expect(lines).toHaveLength(5); // header + 4 ready rows
    expect(vars.csv).not.toContain("Deepa"); // missing last name
    expect(vars.csv).not.toContain("Imran"); // in-file duplicate
  });

  test("blocks submission until every required column is mapped", async () => {
    render(<ImportLeadsPage />);
    fireEvent.change(screen.getByLabelText(/csv text/i), {
      target: { value: "who,digits\nRahul,9876543210" },
    });

    // "who" cannot be resolved to last_name → the required mapping is missing.
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "" },
    });

    await flushAutoDuplicateCheck();

    expect(
      screen.getByText(/map every required column before importing/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^import /i })).toBeDisabled();
    expect(importMutate).not.toHaveBeenCalled();
  });

  test("pasted CSV can be re-mapped by hand", async () => {
    render(<ImportLeadsPage />);
    fireEvent.change(screen.getByLabelText(/csv text/i), {
      target: { value: "a,b,c\nRahul,Sharma,+91 98765 43210" },
    });

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "a" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "b" },
    });
    fireEvent.change(screen.getByLabelText(/^phone/i), {
      target: { value: "c" },
    });

    await flushAutoDuplicateCheck();

    expect(tile("Ready")).toHaveTextContent("1");
    expect(
      screen.getByRole("button", { name: /import 1 lead$/i }),
    ).toBeEnabled();
  });

  /* -----------------------------------------------------------------------
   * Generic shell — the same components, re-parameterised per entity.
   * --------------------------------------------------------------------- */

  test("switching entity resets the source and retargets the endpoint", async () => {
    render(<ImportLeadsPage />);
    fireEvent.click(screen.getByRole("button", { name: /load sample csv/i }));
    await flushAutoDuplicateCheck();
    expect(tile("Rows parsed")).toHaveTextContent("6");

    await selectEntity("dealers");

    // File, mapping and preview are all cleared.
    expect(tile("Rows parsed")).toHaveTextContent("0");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/csv text/i)).toHaveValue("");
    expect(lastImportConfig?.key).toBe("dealers");
    expect(lastImportConfig?.endpoint({})).toBe("/api/dealers/import");
  });

  test("dealers: sample stages rows, flags the out-of-range commission", async () => {
    render(<ImportLeadsPage />);
    await selectEntity("dealers");
    fireEvent.click(screen.getByRole("button", { name: /load sample csv/i }));
    await flushAutoDuplicateCheck();

    expect(tile("Rows parsed")).toHaveTextContent("4");
    expect(tile("Ready")).toHaveTextContent("3");
    // Routing rules are a lead concept — no assignment tile here.
    expect(screen.queryByLabelText(/^assignment mode:/i)).not.toBeInTheDocument();

    expect(screen.getByLabelText(/^name/i)).toHaveValue("Dealer Name");
    expect(screen.getByLabelText(/^email/i)).toHaveValue("Email Address");
    expect(screen.getByLabelText(/commission rate/i)).toHaveValue("Commission %");

    expect(
      screen.getByText(/commission rate must be at most 100/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^import 3 dealers$/i }),
    ).toBeEnabled();
  });

  test("units: import is blocked until a project is chosen, tower rule follows project type", async () => {
    render(<ImportLeadsPage />);
    await selectEntity("units");
    fireEvent.click(screen.getByRole("button", { name: /load sample csv/i }));
    await flushAutoDuplicateCheck();

    expect(tile("Rows parsed")).toHaveTextContent("4");
    // No project yet -> submit is blocked even though rows parse.
    expect(
      screen.getByText(/select a project above before importing units/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^import /i })).toBeDisabled();

    // Apartment project: the sample's "Tower A" rows are fine; only the
    // non-integer bedroom row is bad.
    fireEvent.change(screen.getByLabelText(/units are imported into a single project/i), {
      target: { value: "p-apartment" },
    });
    await flushAutoDuplicateCheck();
    expect(tile("Ready")).toHaveTextContent("3");
    expect(screen.getByText(/bedrooms is not a number/i)).toBeInTheDocument();
    expect(lastImportConfig?.endpoint({ projectId: "p-apartment" })).toBe(
      "/api/projects/p-apartment/units/import",
    );

    // Villa project: towers are forbidden, so every "Tower A" row is flagged.
    fireEvent.change(screen.getByLabelText(/units are imported into a single project/i), {
      target: { value: "p-villa" },
    });
    await flushAutoDuplicateCheck();
    expect(tile("Ready")).toHaveTextContent("0");
    expect(
      screen.getAllByText(/villa\/plotted projects do not use towers/i).length,
    ).toBe(4);
  });

  test("bookings: a unit number without a project is not importable", async () => {
    render(<ImportLeadsPage />);
    await selectEntity("bookings");
    fireEvent.click(screen.getByRole("button", { name: /load sample csv/i }));
    await flushAutoDuplicateCheck();

    expect(tile("Rows parsed")).toHaveTextContent("3");
    expect(tile("Ready")).toHaveTextContent("2");
    expect(
      screen.getByText(/project name is required when matching by unit number/i),
    ).toBeInTheDocument();
    // The raw-UUID escape hatches are offered, but as a separate group.
    expect(screen.getByText(/advanced — raw ids/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lead id/i)).toBeInTheDocument();
  });

  test("tasks: no duplicates tile, and an unparseable due date blocks the row", async () => {
    render(<ImportLeadsPage />);
    await selectEntity("tasks");
    fireEvent.click(screen.getByRole("button", { name: /load sample csv/i }));
    await flushAutoDuplicateCheck();

    expect(tile("Rows parsed")).toHaveTextContent("4");
    expect(tile("Ready")).toHaveTextContent("3");
    // Tasks have no natural unique key, so the tile is omitted entirely
    // rather than showing a permanent zero.
    expect(screen.queryByLabelText(/^duplicates:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/due date must be an iso date/i)).toBeInTheDocument();
    expect(lastImportConfig?.endpoint({})).toBe("/api/tasks/import");
  });

  test("submitted CSV uses the active entity's canonical headers", async () => {
    render(<ImportLeadsPage />);
    await selectEntity("tasks");
    fireEvent.click(screen.getByRole("button", { name: /load sample csv/i }));
    await flushAutoDuplicateCheck();

    fireEvent.click(screen.getByRole("button", { name: /^import 3 tasks$/i }));

    expect(importMutate).toHaveBeenCalledTimes(1);
    const [vars] = importMutate.mock.calls[0] as [{ csv: string }];
    const lines = vars.csv.split("\r\n");
    expect(lines[0]).toBe(
      "title,description,priority,due_date,assigned_to_email",
    );
    expect(lines).toHaveLength(4); // header + 3 ready rows
    expect(vars.csv).not.toContain("next tuesday");
  });
});
