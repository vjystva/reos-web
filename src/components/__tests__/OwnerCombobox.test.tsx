/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OwnerCombobox } from "@/components/OwnerCombobox";
import { taskOwnerOptions } from "@/lib/taskBoard";

/** Mirrors the real tenant payload: a few real people, lots of e2e seed junk. */
const USERS = [
  { id: "a1", email: "asha.rao@reos.com", role: "sales_agent" },
  { id: "m1", email: "amit.manager@reos.com", role: "sales_manager" },
  { id: "d1", email: "dealer.test.1782018963825@reos.com", role: "dealer" },
  { id: "r1", email: "rbac.test.1782019795008@reos.com", role: "sales_agent" },
];

function renderPicker(
  overrides: Partial<React.ComponentProps<typeof OwnerCombobox>> = {},
) {
  const onChange = jest.fn();
  const utils = render(
    <OwnerCombobox
      id="task-assigned-to"
      users={taskOwnerOptions(USERS)}
      value=""
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange, ...utils };
}

function openList() {
  fireEvent.focus(screen.getByRole("combobox"));
}

describe("OwnerCombobox", () => {
  test("shows derived names rather than raw email addresses", () => {
    renderPicker();
    openList();

    expect(screen.getByRole("option", { name: /Asha Rao/ })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Amit Manager/ }),
    ).toBeInTheDocument();
  });

  test("excludes dealer-role accounts from the owner list", () => {
    renderPicker();
    openList();

    expect(
      screen.queryByText("dealer.test.1782018963825@reos.com"),
    ).not.toBeInTheDocument();
  });

  test("options are sorted by display name", () => {
    renderPicker();
    openList();

    const names = screen
      .getAllByRole("option")
      .map((li) => within(li).getAllByText(/.+/)[0].textContent);
    expect(names).toEqual(["Amit Manager", "Asha Rao", "Rbac Test 1782019795008"]);
  });

  test("typing a name filters the list", () => {
    renderPicker();
    const input = screen.getByRole("combobox");
    openList();
    fireEvent.change(input, { target: { value: "amit" } });

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Amit Manager");
  });

  test("filtering works on a partial name the email does not start with", () => {
    renderPicker();
    const input = screen.getByRole("combobox");
    openList();
    fireEvent.change(input, { target: { value: "rao" } });

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Asha Rao");
  });

  test("selecting an option reports the user id, not the label", () => {
    const { onChange } = renderPicker();
    openList();
    fireEvent.mouseDown(screen.getByRole("option", { name: /Asha Rao/ }));

    expect(onChange).toHaveBeenCalledWith("a1");
  });

  test("keyboard arrow + enter picks an owner", () => {
    const { onChange } = renderPicker();
    const input = screen.getByRole("combobox");
    openList();
    // Sorted list: [Amit Manager, Asha Rao, Rbac …] — one ArrowDown = Asha Rao.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("a1");
  });

  test("reports an empty result instead of an empty box", () => {
    renderPicker();
    const input = screen.getByRole("combobox");
    openList();
    fireEvent.change(input, { target: { value: "zzzz" } });

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(/No owner matches/)).toBeInTheDocument();
  });

  test("a selected owner renders by name when closed", () => {
    renderPicker({ value: "m1" });
    expect(screen.getByRole("combobox")).toHaveValue("Amit Manager");
  });

  test("clearing the selection emits an empty id", () => {
    const { onChange } = renderPicker({ value: "m1" });
    fireEvent.click(screen.getByRole("button", { name: "Clear owner" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  test("the optional empty row is offered when asked for", () => {
    const { onChange } = renderPicker({
      value: "m1",
      emptyOptionLabel: "All owners",
    });
    openList();
    fireEvent.mouseDown(screen.getByRole("option", { name: "All owners" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  test("escape closes the list", () => {
    renderPicker();
    const input = screen.getByRole("combobox");
    openList();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
