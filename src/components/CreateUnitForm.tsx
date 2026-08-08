"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CreateTowerForm } from "@/components/CreateTowerForm";
import { useTowers } from "@/hooks/useTowers";
import { useCreateTowerMutation } from "@/hooks/useCreateTowerMutation";
import {
  CreateUnitRequestSchema,
  FACING_DIRECTIONS,
  type CreateTowerRequest,
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
  /**
   * Whether the user may create towers inline. Mirrors the backend's
   * `builder_admin`-only `POST /projects/:id/towers`. Defaults to true
   * because the whole form is already gated on the same role at the call
   * site.
   */
  canAddTower?: boolean;
}

type FieldErrors = Partial<Record<keyof CreateUnitRequest, string>>;

export function CreateUnitForm({
  projectId,
  isApartment,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  canAddTower = true,
}: CreateUnitFormProps) {
  const towersQ = useTowers(isApartment ? projectId : null);

  const [towerId, setTowerId] = React.useState("");
  const [unitNumber, setUnitNumber] = React.useState("");
  const [floor, setFloor] = React.useState("");
  const [bedrooms, setBedrooms] = React.useState("");
  const [area, setArea] = React.useState("");
  const [superArea, setSuperArea] = React.useState("");
  const [carpetArea, setCarpetArea] = React.useState("");
  const [balconyArea, setBalconyArea] = React.useState("");
  const [facing, setFacing] = React.useState("");
  const [isCorner, setIsCorner] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  // Inline tower creation — without this, an apartment project with zero
  // towers is a hard dead end: the Tower select has nothing to pick and the
  // form cannot be submitted.
  const [towerFormOpen, setTowerFormOpen] = React.useState(false);
  const [towerError, setTowerError] = React.useState<string | null>(null);
  const createTower = useCreateTowerMutation(projectId);

  const towers = React.useMemo(
    () => towersQ.data?.data ?? [],
    [towersQ.data],
  );
  const noTowers = !towersQ.isLoading && towers.length === 0;

  async function handleCreateTower(data: CreateTowerRequest) {
    setTowerError(null);
    try {
      const created = await createTower.mutateAsync(data);
      // `useCreateTowerMutation` invalidates ["towers", projectId], so
      // `towersQ` above refetches and the <select> repopulates. Select the
      // new tower right away so the user never sees an empty dropdown.
      setTowerFormOpen(false);
      if (created?.id) {
        setTowerId(created.id);
        setFieldErrors((prev) => ({ ...prev, towerId: undefined }));
      }
    } catch (err) {
      setTowerError(err instanceof Error ? err.message : "Failed to add tower");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Apartment projects need a tower selected before we can build the
    // payload. Villa/plotted projects must NOT send one — the backend
    // rejects `towerId` on those with "Villa/plotted projects do not use
    // towers" — so the field is not just optional there, it is absent.
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
    // Optional area breakdown — omit the key entirely when left blank so the
    // backend stores NULL ("not captured") rather than 0.
    if (superArea.trim()) raw.superArea = Number(superArea);
    if (carpetArea.trim()) raw.carpetArea = Number(carpetArea);
    if (balconyArea.trim()) raw.balconyArea = Number(balconyArea);
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
            {towers.map((t) => (
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

          {noTowers && !towerFormOpen ? (
            <p className="text-xs text-amber-600">
              This project has no towers yet
              {canAddTower ? " — add one below." : "."}
            </p>
          ) : null}

          {canAddTower && !towerFormOpen ? (
            <button
              type="button"
              onClick={() => {
                setTowerFormOpen(true);
                setTowerError(null);
              }}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              + Add tower
            </button>
          ) : null}

          {canAddTower && towerFormOpen ? (
            <div className="mt-2 rounded-md border border-dashed border-border p-3">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                New tower
              </p>
              <CreateTowerForm
                idPrefix="inline-tower"
                submitLabel="Create tower"
                isSubmitting={createTower.isPending}
                error={towerError}
                onSubmit={(data) => void handleCreateTower(data)}
                onCancel={() => {
                  setTowerFormOpen(false);
                  setTowerError(null);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          This project type does not use towers — units are added directly to
          the project.
        </p>
      )}

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
        <p className="text-[11px] text-slate-500">
          Chargeable area used for pricing and listings.
        </p>
        {fieldErrors.area && (
          <p className="text-xs text-red-600">{fieldErrors.area}</p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          Area breakdown <span className="text-slate-400">(optional)</span>
        </legend>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label
              className="block text-xs font-medium text-slate-600"
              htmlFor="unit-super-area"
            >
              Super area
            </label>
            <Input
              id="unit-super-area"
              type="number"
              step="0.01"
              min={0}
              value={superArea}
              onChange={(e) => setSuperArea(e.target.value)}
              placeholder="1250"
            />
            {fieldErrors.superArea && (
              <p className="text-xs text-red-600">{fieldErrors.superArea}</p>
            )}
          </div>
          <div className="space-y-1">
            <label
              className="block text-xs font-medium text-slate-600"
              htmlFor="unit-carpet-area"
            >
              Carpet area
            </label>
            <Input
              id="unit-carpet-area"
              type="number"
              step="0.01"
              min={0}
              value={carpetArea}
              onChange={(e) => setCarpetArea(e.target.value)}
              placeholder="850"
            />
            {fieldErrors.carpetArea && (
              <p className="text-xs text-red-600">{fieldErrors.carpetArea}</p>
            )}
          </div>
          <div className="space-y-1">
            <label
              className="block text-xs font-medium text-slate-600"
              htmlFor="unit-balcony-area"
            >
              Balcony area
            </label>
            <Input
              id="unit-balcony-area"
              type="number"
              step="0.01"
              min={0}
              value={balconyArea}
              onChange={(e) => setBalconyArea(e.target.value)}
              placeholder="80"
            />
            {fieldErrors.balconyArea && (
              <p className="text-xs text-red-600">{fieldErrors.balconyArea}</p>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          All in sqft. Leave blank if not captured.
        </p>
      </fieldset>

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
