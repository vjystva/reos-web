import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types/api";

const TYPE_LABELS: Record<string, string> = {
  apartment: "APARTMENT",
  villa: "VILLA",
  plotted: "PLOTTED",
};

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const typeKey = String(project.type).toLowerCase();
  const typeLabel = TYPE_LABELS[typeKey] ?? typeKey.toUpperCase();
  const location = project.city ?? project.location ?? null;

  return (
    <Card className="flex flex-col transition-colors hover:border-foreground/20">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <Badge variant="outline" className="w-fit tracking-wider">
          {typeLabel}
        </Badge>
        {project.isActive === false ? (
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Inactive
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
            {project.name}
          </h3>
          {location ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {location}
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <div>
            <dt className="uppercase tracking-wider">Launch</dt>
            <dd className="font-mono tabular-nums text-foreground">
              {formatDate(project.launchDate)}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider">Possession</dt>
            <dd className="font-mono tabular-nums text-foreground">
              {formatDate(project.possessionDate)}
            </dd>
          </div>
        </dl>

        <Link
          href={`/dashboard/inventory/${project.id}`}
          className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          aria-label={`View inventory for ${project.name}`}
        >
          View inventory <span aria-hidden="true">→</span>
        </Link>
      </CardContent>
    </Card>
  );
}
