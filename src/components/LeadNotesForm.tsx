"use client";
import * as React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
        aria-label="Lead notes"
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes…"
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </div>
  );
}
