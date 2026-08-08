"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useUsers } from "@/hooks/useUsers";
import {
  ScheduleVisitRequestSchema,
  type ScheduleVisitRequest,
} from "@/types/api";

const LABEL = "block text-sm font-medium text-slate-700";
const FIELD_ERROR = "text-xs text-red-600";

interface ScheduleVisitFormProps {
  /** Resolved from the booking — `site_visits` rows are lead-scoped upstream. */
  leadId: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: ScheduleVisitRequest) => void;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof ScheduleVisitRequest, string>>;

/**
 * `<input type="datetime-local">` yields "2026-09-01T14:30" (no zone). The
 * backend's `@IsDateString()` wants a full ISO-8601 instant, so convert.
 */
function toIso(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

/** Default to tomorrow 11:00 local — a plausible slot, never in the past. */
function defaultSlot(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(11, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function userLabel(email: string): string {
  return email.split("@")[0] || email;
}

/**
 * Schedules a site visit via `POST /site-visits` (`CreateSiteVisitDto`).
 *
 * `assignedAgentId` is a REQUIRED NOT NULL FK upstream — the reason this form
 * has to pick an owner rather than just a date. Creating the visit also
 * auto-advances a `new`/`contacted` lead to `site_visit_scheduled`
 * server-side.
 */
export function ScheduleVisitForm({
  leadId,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: ScheduleVisitFormProps) {
  const usersQuery = useUsers();
  const agents = React.useMemo(
    () =>
      (usersQuery.data?.data ?? [])
        .filter((u) =>
          ["sales_agent", "sales_manager", "builder_admin", "dealer"].includes(
            u.role,
          ),
        )
        .sort((a, b) => a.email.localeCompare(b.email)),
    [usersQuery.data],
  );

  const [assignedAgentId, setAssignedAgentId] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState(defaultSlot());
  const [notes, setNotes] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  // Preselect the first agent once the roster lands so the happy path is one
  // click, not two.
  React.useEffect(() => {
    if (!assignedAgentId && agents.length > 0) {
      setAssignedAgentId(agents[0].id);
    }
  }, [agents, assignedAgentId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = {
      leadId,
      assignedAgentId,
      scheduledAt: toIso(scheduledAt),
      notes: notes || undefined,
    };
    const result = ScheduleVisitRequestSchema.safeParse(raw);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ScheduleVisitRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label className={LABEL} htmlFor="schedule-visit-agent">
          Assigned agent
        </label>
        <Select
          id="schedule-visit-agent"
          value={assignedAgentId}
          onChange={(e) => setAssignedAgentId(e.target.value)}
          disabled={usersQuery.isLoading}
        >
          <option value="">
            {usersQuery.isLoading ? "Loading agents…" : "Select an agent"}
          </option>
          {agents.map((u) => (
            <option key={u.id} value={u.id}>
              {userLabel(u.email)} · {u.role.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        {fieldErrors.assignedAgentId && (
          <p className={FIELD_ERROR}>{fieldErrors.assignedAgentId}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="schedule-visit-date">
          Visit date &amp; time
        </label>
        <Input
          id="schedule-visit-date"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        {fieldErrors.scheduledAt && (
          <p className={FIELD_ERROR}>{fieldErrors.scheduledAt}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className={LABEL} htmlFor="schedule-visit-notes">
          Notes <span className="text-slate-400">(optional)</span>
        </label>
        <Input
          id="schedule-visit-notes"
          type="text"
          maxLength={2000}
          placeholder="Customer wants to see the 3 BHK show flat"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {fieldErrors.notes && <p className={FIELD_ERROR}>{fieldErrors.notes}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Scheduling…" : "Schedule visit"}
        </Button>
      </div>
    </form>
  );
}
