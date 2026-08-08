"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CreateTowerRequestSchema,
  FACING_DIRECTIONS,
  type CreateTowerRequest,
} from "@/types/api";

interface CreateTowerFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateTowerRequest) => void;
  onCancel: () => void;
  /** Label for the submit button. Defaults to "Add tower". */
  submitLabel?: string;
  /** Prefix for input `id`s so two instances can coexist on one page. */
  idPrefix?: string;
}

type FieldErrors = Partial<Record<keyof CreateTowerRequest, string>>;

/**
 * Minimal tower form — the three fields the backend `CreateTowerDto` accepts
 * (`name`, `totalFloors` required; `facingDirection` optional). Presentation
 * only: the caller owns the mutation and the surrounding dialog/sheet, so the
 * same component serves both the sidebar affordance and the inline
 * "no towers yet" escape hatch in `CreateUnitForm`.
 */
export function CreateTowerForm({
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  submitLabel = "Add tower",
  idPrefix = "tower",
}: CreateTowerFormProps) {
  const [name, setName] = React.useState("");
  const [totalFloors, setTotalFloors] = React.useState("");
  const [facingDirection, setFacingDirection] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    // Stop the event reaching an outer <form> — this component is rendered
    // INSIDE CreateUnitForm's form in the inline case, and nested forms are
    // invalid HTML, so that instance is a <div> whose submit we drive here.
    e.preventDefault();
    e.stopPropagation();

    const raw: Record<string, unknown> = {
      name: name.trim(),
      totalFloors: Number(totalFloors),
    };
    if (facingDirection) raw.facingDirection = facingDirection;

    const result = CreateTowerRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateTowerRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor={`${idPrefix}-name`}
        >
          Tower Name
        </label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tower A"
          maxLength={100}
        />
        {fieldErrors.name && (
          <p className="text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor={`${idPrefix}-floors`}
          >
            Total Floors
          </label>
          <Input
            id={`${idPrefix}-floors`}
            type="number"
            min={1}
            max={500}
            value={totalFloors}
            onChange={(e) => setTotalFloors(e.target.value)}
            placeholder="12"
          />
          {fieldErrors.totalFloors && (
            <p className="text-xs text-red-600">{fieldErrors.totalFloors}</p>
          )}
        </div>

        <div className="space-y-1">
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor={`${idPrefix}-facing`}
          >
            Facing <span className="text-slate-400">(optional)</span>
          </label>
          <Select
            id={`${idPrefix}-facing`}
            value={facingDirection}
            onChange={(e) => setFacingDirection(e.target.value)}
          >
            <option value="">—</option>
            {FACING_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          {fieldErrors.facingDirection && (
            <p className="text-xs text-red-600">
              {fieldErrors.facingDirection}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
