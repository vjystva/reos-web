"use client";
import * as React from "react";
import { z } from "zod";
import { useUpdateLeadMutation } from "@/hooks/useUpdateLeadMutation";

const schema = z.object({ notes: z.string().min(1, "Notes cannot be empty") });

interface LeadNotesFormProps {
  leadId: string;
  initialNotes?: string;
  onSuccess?: () => void;
}

export function LeadNotesForm({ leadId, initialNotes = "", onSuccess }: LeadNotesFormProps) {
  const [notes, setNotes] = React.useState(initialNotes);
  const [error, setError] = React.useState<string | null>(null);
  const mutation = useUpdateLeadMutation(leadId);

  const handleSave = async () => {
    const result = schema.safeParse({ notes });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid notes");
      return;
    }
    setError(null);
    await mutation.mutateAsync({ notes: result.data.notes });
    onSuccess?.();
  };

  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes..."
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleSave}
        disabled={mutation.isPending}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Save Notes"}
      </button>
    </div>
  );
}
