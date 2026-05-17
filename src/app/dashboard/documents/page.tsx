"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import {
  DOCUMENT_RESOURCE_TYPES,
  type DocumentResourceType,
} from "@/types/api";

export default function DocumentsPage() {
  const [resourceType, setResourceType] =
    React.useState<DocumentResourceType>("booking");
  const [resourceIdInput, setResourceIdInput] = React.useState("");
  const [committedResourceId, setCommittedResourceId] = React.useState("");

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setCommittedResourceId(resourceIdInput.trim());
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500">
          Browse documents linked to a booking, lead, project, or task.
        </p>
      </header>

      <form
        onSubmit={handleApply}
        className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700" htmlFor="filter-resource-type">
            Resource type
          </label>
          <Select
            id="filter-resource-type"
            value={resourceType}
            onChange={(e) =>
              setResourceType(e.target.value as DocumentResourceType)
            }
            className="w-44"
          >
            {DOCUMENT_RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700" htmlFor="filter-resource-id">
            Resource ID
          </label>
          <Input
            id="filter-resource-id"
            type="text"
            value={resourceIdInput}
            onChange={(e) => setResourceIdInput(e.target.value)}
            placeholder={`${resourceType}-uuid`}
            className="w-72"
          />
        </div>

        <div>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!resourceIdInput.trim()}
          >
            View documents
          </button>
        </div>
      </form>

      {committedResourceId ? (
        <DocumentsPanel
          resourceType={resourceType}
          resourceId={committedResourceId}
        />
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
          Enter a resource ID above and click <strong>View documents</strong> to load.
        </div>
      )}
    </div>
  );
}
