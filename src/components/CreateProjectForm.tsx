"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CreateProjectRequestSchema,
  type CreateProjectRequest,
} from "@/types/api";

interface CreateProjectFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: CreateProjectRequest) => void;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof CreateProjectRequest, string>>;

export function CreateProjectForm({
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: CreateProjectFormProps) {
  const [name, setName] = React.useState("");
  const [projectType, setProjectType] = React.useState("apartment");
  const [location, setLocation] = React.useState("");
  const [city, setCity] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [launchDate, setLaunchDate] = React.useState("");
  const [possessionDate, setPossessionDate] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw: Record<string, unknown> = {
      name: name.trim(),
      projectType,
      location: location.trim(),
      city: city.trim(),
    };
    if (description.trim()) raw.description = description.trim();
    if (launchDate) raw.launchDate = launchDate;
    if (possessionDate) raw.possessionDate = possessionDate;

    const result = CreateProjectRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateProjectRequest;
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

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="proj-name">
          Project Name
        </label>
        <Input
          id="proj-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Green Valley"
          maxLength={255}
          required
        />
        {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="proj-type">
          Project Type
        </label>
        <Select
          id="proj-type"
          value={projectType}
          onChange={(e) => setProjectType(e.target.value)}
        >
          <option value="apartment">Apartment</option>
          <option value="villa">Villa</option>
          <option value="plotted">Plotted</option>
        </Select>
        {fieldErrors.projectType && <p className="text-xs text-red-600">{fieldErrors.projectType}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="proj-city">
            City
          </label>
          <Input
            id="proj-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Noida"
            maxLength={100}
            required
          />
          {fieldErrors.city && <p className="text-xs text-red-600">{fieldErrors.city}</p>}
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="proj-location">
            Area / Sector
          </label>
          <Input
            id="proj-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Sector 22, Noida"
            maxLength={500}
            required
          />
          {fieldErrors.location && <p className="text-xs text-red-600">{fieldErrors.location}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="proj-launch">
            Launch Date <span className="text-slate-400">(optional)</span>
          </label>
          <Input
            id="proj-launch"
            type="date"
            value={launchDate}
            onChange={(e) => setLaunchDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="proj-possession">
            Possession Date <span className="text-slate-400">(optional)</span>
          </label>
          <Input
            id="proj-possession"
            type="date"
            value={possessionDate}
            onChange={(e) => setPossessionDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="proj-desc">
          Description <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="proj-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Premium residential project…"
          maxLength={5000}
          rows={3}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
