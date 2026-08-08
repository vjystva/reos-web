"use client";

import * as React from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import type { Project } from "@/types/api";

interface ImportProjectCardProps {
  step: number;
  value: string;
  onChange: (projectId: string, project: Project | undefined) => void;
}

/**
 * Project scope selector — rendered only for entities whose backend import is
 * project-scoped by URL (currently Units:
 * `POST /projects/:projectId/units/import/csv`).
 *
 * The selected project's TYPE matters, not just its id: apartment projects
 * require every unit to resolve to a tower, villa/plotted projects forbid
 * towers entirely. The page feeds that type into the staging context so the
 * preview flags tower mistakes before submit rather than after.
 */
export function ImportProjectCard({
  step,
  value,
  onChange,
}: ImportProjectCardProps) {
  const projects = useProjects({ pageSize: 100 });
  const list = projects.data?.data ?? [];
  const selected = list.find((p) => p.id === value);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{step} · Project</CardTitle>
        {selected ? (
          <span className="text-[11px] text-muted-foreground">
            {selected.type === "apartment"
              ? "Apartment project — every row needs a Tower"
              : `${selected.type} project — Tower must be blank`}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1">
          <label
            htmlFor="import-project"
            className="block text-[11px] font-medium text-foreground"
          >
            Units are imported into a single project
          </label>
          <Select
            id="import-project"
            className="max-w-md"
            value={value}
            disabled={projects.isLoading}
            onChange={(e) =>
              onChange(
                e.target.value,
                list.find((p) => p.id === e.target.value),
              )
            }
          >
            <option value="">
              {projects.isLoading ? "Loading projects…" : "— select a project —"}
            </option>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.type})
              </option>
            ))}
          </Select>
        </div>

        {projects.isError ? (
          <ErrorBanner
            message="Could not load projects."
            onRetry={() => void projects.refetch()}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
