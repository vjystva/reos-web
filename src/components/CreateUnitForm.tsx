"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useTowers } from "@/hooks/useTowers";
import {
  CreateUnitRequestSchema,
  FACING_DIRECTIONS,
  type CreateUnitRequest,
} from "@/types/api";

interface CreateUnitFormProps {
  projectId: string;
  /** Apartment projects require a tower; villa/plotted must not send one. */
  isApartment: boolean;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateUnitRequest) => void;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof CreateUnitRequest, string>>;

export function CreateUnitForm({
  projectId,
  isApartment,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: CreateUnitFormProps) {
  const towersQ = useTowers(isApartment ? projectId : null);

  const [towerId, setTowerId] = React.useState("");
  const [unitNumber, setUnitNumber] = React.useState("");
  const [floor, setFloor] = React.useState("");
  const [bedrooms, setBedrooms] = React.useState("");
  const [area, setArea] = React.useState("");
  const [facing, setFacing] = React.useState("");
  const [isCorner, setIsCorner] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Apartment projects need a tower selected before we can build the payload.
    if (isApartment && !towerId) {
      setFieldErrors({ towerId: "Select a tower" });
      return;
    }

    const raw: Record<string, unknown> = {
      unitNumber: unitNumber.trim(),
      floor: Number(floor),
      bedrooms: Number(bedrooms),
      area: Number(area),
    };
    if (isApartment) raw.towerId = towerId;
    if (facing) raw.facing = facing;
    if (isCorner) raw.isCorner = true;

    const result = CreateUnitRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateUnitRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <ErrorBanner message={error} />}

      {isApartment ? (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="unit-tower">
            Tower
          </label>
          <Select
            id="unit-tower"
            value={towerId}
            onChange={(e) => setTowerId(e.target.value)}
            disabled={towersQ.isLoading}
            required
          >
            <option value="">
              {towersQ.isLoading ? "Loading towers…" : "Select a tower"}
            </option>
            {(towersQ.data?.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          {fieldErrors.towerId && (
            <p className="text-xs text-red-600">{fieldErrors.towerId}</p>
          )}
          {towersQ.isError && (
            <p className="text-xs text-red-600">Could not load towers.</p>
          )}
          {!towersQ.isLoading && (towersQ.data?.data ?? []).length === 0 && (
            <p className="text-xs text-amber-600">
              This project has no towers yet — add a tower before adding units.
            </p>
          )}
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="unit-number">
          Unit Number
        </label>
        <Input
          id="unit-number"
          value={unitNumber}
          onChange={(e) => setUnitNumber(e.target.value)}
          placeholder="101"
          maxLength={50}
          required
        />
        {fieldErrors.unitNumber && (
          <p className="text-xs text-red-600">{fieldErrors.unitNumber}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="unit-floor">
            Floor
          </label>
          <Input
            id="unit-floor"
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="1"
            required
          />
          {fieldErrors.floor && (
            <p className="text-xs text-red-600">{fieldErrors.floor}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="unit-bedrooms">
            Bedrooms
          </label>
          <Input
            id="unit-bedrooms"
            type="number"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            placeholder="2"
            required
          />
          {fieldErrors.bedrooms && (
            <p className="text-xs text-red-600">{fieldErrors.bedrooms}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="unit-area">
          Area (sqft)
        </label>
        <Input
          id="unit-area"
          type="number"
          step="0.01"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="950"
          required
        />
        {fieldErrors.area && (
          <p className="text-xs text-red-600">{fieldErrors.area}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="unit-facing">
            Facing <span className="text-slate-400">(optional)</span>
          </label>
          <Select
            id="unit-facing"
            value={facing}
            onChange={(e) => setFacing(e.target.value)}
          >
            <option value="">—</option>
            {FACING_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isCorner}
              onChange={(e) => setIsCorner(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Corner unit
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add unit"}
        </Button>
      </div>
    </form>
  );
}
