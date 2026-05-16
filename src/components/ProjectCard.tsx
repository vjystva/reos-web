import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  return (
    <Card>
      <CardHeader>
        <Badge variant="outline" className="w-fit">
          {typeLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {project.name}
          </h3>
          {project.city ? (
            <p className="text-sm text-slate-500">{project.city}</p>
          ) : null}
        </div>
        <Link
          href={`/dashboard/inventory/${project.id}`}
          className="inline-flex items-center text-sm font-medium text-slate-700 hover:underline"
          aria-label={`View inventory for ${project.name}`}
        >
          View inventory →
        </Link>
      </CardContent>
    </Card>
  );
}
