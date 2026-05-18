/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TemplateForm } from "@/components/TemplateForm";
import type { CreateTemplateRequest } from "@/types/api";

function renderForm(
  overrides: Partial<React.ComponentProps<typeof TemplateForm>> = {},
) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  const utils = render(
    <TemplateForm
      isSubmitting={false}
      error={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onSubmit, onCancel, ...utils };
}

function getFormElement(): HTMLFormElement {
  const btn = screen.getByRole("button", { name: /create template|save/i });
  const form = btn.closest("form");
  if (!form) throw new Error("form not found");
  return form as HTMLFormElement;
}

describe("TemplateForm", () => {
  test("renders the core controls", () => {
    renderForm();
    expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Channel$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Body$/i)).toBeInTheDocument();
  });

  test("submitting an empty form does not call onSubmit", () => {
    const { onSubmit } = renderForm();
    fireEvent.submit(getFormElement());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("submitting with name and body calls onSubmit with default channel email", () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText(/^Name$/i), {
      target: { value: "Welcome" },
    });
    fireEvent.change(screen.getByLabelText(/^Body$/i), {
      target: { value: "Hello {{name}}" },
    });
    fireEvent.submit(getFormElement());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as CreateTemplateRequest;
    expect(payload.name).toBe("Welcome");
    expect(payload.channel).toBe("email");
    expect(payload.bodyTemplate).toBe("Hello {{name}}");
    expect(payload.isActive).toBe(true);
  });

  test("switching channel to sms hides the Subject field", () => {
    renderForm();
    expect(screen.queryByLabelText(/Subject/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Channel$/i), {
      target: { value: "sms" },
    });
    expect(screen.queryByLabelText(/Subject/i)).not.toBeInTheDocument();
  });

  test("variables CSV is split and trimmed before submit", () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText(/^Name$/i), {
      target: { value: "T" },
    });
    fireEvent.change(screen.getByLabelText(/^Body$/i), {
      target: { value: "B" },
    });
    fireEvent.change(screen.getByLabelText(/Variables/i), {
      target: { value: "a, b , ,c" },
    });
    fireEvent.submit(getFormElement());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as CreateTemplateRequest;
    expect(payload.variables).toEqual(["a", "b", "c"]);
  });

  test("clicking Cancel calls onCancel", () => {
    const { onCancel } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
