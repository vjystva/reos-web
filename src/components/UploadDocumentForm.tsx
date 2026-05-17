"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  CreateDocumentRequestSchema,
  DOCUMENT_FILE_TYPES,
  type CreateDocumentRequest,
  type Document,
  type DocumentFileType,
  type DocumentResourceType,
} from "@/types/api";

interface UploadDocumentFormProps {
  resourceType: DocumentResourceType;
  resourceId: string;
  onSuccess?: (doc: Document) => void;
  onCancel: () => void;
  onSubmit: (data: CreateDocumentRequest) => Promise<Document | void>;
  isSubmitting: boolean;
  error: string | null;
}

type FieldErrors = Partial<Record<keyof CreateDocumentRequest, string>>;

export function UploadDocumentForm({
  resourceType,
  resourceId,
  onSuccess,
  onCancel,
  onSubmit,
  isSubmitting,
  error,
}: UploadDocumentFormProps) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [fileType, setFileType] = React.useState<DocumentFileType>("pdf");
  const [fileSize, setFileSize] = React.useState<string>("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const raw: Record<string, unknown> = {
      resourceType,
      resourceId,
      name: name.trim(),
      url: url.trim(),
      fileType,
    };
    if (fileSize.trim()) {
      const parsedSize = Number(fileSize);
      if (Number.isFinite(parsedSize)) {
        raw.fileSize = parsedSize;
      } else {
        setFieldErrors({ fileSize: "Enter a valid number" });
        return;
      }
    }

    const result = CreateDocumentRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateDocumentRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const created = await onSubmit(result.data);
    if (created && onSuccess) onSuccess(created);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="doc-name">
          Document name
        </label>
        <Input
          id="doc-name"
          type="text"
          maxLength={255}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sale agreement"
          required
        />
        {fieldErrors.name && (
          <p className="text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="doc-url">
          File URL
        </label>
        <Input
          id="doc-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://files.example.com/sale-agreement.pdf"
          required
        />
        {fieldErrors.url && (
          <p className="text-xs text-red-600">{fieldErrors.url}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="doc-file-type">
            File type
          </label>
          <Select
            id="doc-file-type"
            value={fileType}
            onChange={(e) => setFileType(e.target.value as DocumentFileType)}
          >
            {DOCUMENT_FILE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()}
              </option>
            ))}
          </Select>
          {fieldErrors.fileType && (
            <p className="text-xs text-red-600">{fieldErrors.fileType}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="doc-file-size">
            File size (bytes) <span className="text-slate-400">(optional)</span>
          </label>
          <Input
            id="doc-file-size"
            type="number"
            min={1}
            step={1}
            value={fileSize}
            onChange={(e) => setFileSize(e.target.value)}
            placeholder="102400"
          />
          {fieldErrors.fileSize && (
            <p className="text-xs text-red-600">{fieldErrors.fileSize}</p>
          )}
        </div>
      </div>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Linking to{" "}
        <span className="font-mono">
          {resourceType}/{resourceId}
        </span>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </form>
  );
}
