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

jest.mock("@/hooks/useImportLeadsMutation", () => ({
  useImportLeadsMutation: () => ({
    mutate: importMutate,
    reset: importReset,
    isPending: false,
    isError: false,
    error: null,
  }),
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
  });

  test("renders the empty state with zeroed tiles and no preview", () => {
    render(<ImportLeadsPage />);
    expect(
      screen.getByRole("heading", { name: /bulk csv import/i }),
    ).toBeInTheDocument();
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
});
