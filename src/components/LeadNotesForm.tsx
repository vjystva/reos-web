"use client";
import * as React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAddLeadNoteMutation } from "@/hooks/useAddLeadNoteMutation";

const schema = z.object({
  notes: z
    .string()
    .trim()
    .min(1, "Notes cannot be empty")
    .max(5000, "Notes must be 5000 characters or fewer"),
});

interface LeadNotesFormProps {
  leadId: string;
  /**
   * Kept for API compatibility with existing callers. Notes are append-only
   * activity rows upstream, so there is no single "current notes" value to
   * seed the textarea with — see the note on `useAddLeadNoteMutation`.
   */
  initialNotes?: string;
  onSuccess?: () => void;
}

/**
 * Adds a note to the lead's activity timeline.
 *
 * Previously this posted `PATCH /api/leads/:id` with `{ notes }`, which the
 * backend rejects — `leads` has no `notes` column and `UpdateLeadDto` runs
 * under a whitelist validator ("property notes should not exist"). The real
 * store is `lead_activities` with `activity_type = 'note'`.
 */
export function LeadNotesForm({ leadId, onSuccess }: LeadNotesFormProps) {
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const mutation = useAddLeadNoteMutation(leadId);

  const handleSave = async () => {
    const result = schema.safeParse({ notes });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid notes");
      return;
    }
    setError(null);
    setSaved(false);
    try {
      await mutation.mutateAsync(result.data.notes);
      setNotes("");
      setSaved(true);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the note. Try again.",
      );
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        aria-label="Lead notes"
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        rows={4}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          if (saved) setSaved(false);
        }}
        maxLength={5000}
        placeholder="Add a note — it lands on the engagement timeline…"
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {saved && !error && (
        <p className="text-[11px] text-muted-foreground">
          Note added to the timeline.
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSave()}
          disabled={mutation.isPending || !notes.trim()}
        >
          {mutation.isPending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </div>
  );
}
