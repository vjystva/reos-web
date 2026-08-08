"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUsers } from "@/hooks/useUsers";
import { LEAD_STAGES } from "@/types/api";
import { stageLabel } from "@/lib/utils";

/** "priya.shah@acme.in" -> "priya.shah" — users have no display-name field. */
function userLabel(email: string): string {
  return email.split("@")[0] || email;
}

const FIELD_LABEL =
  "text-[11px] uppercase tracking-wider text-muted-foreground";

export function PipelineFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const stage = params.get("stage") ?? "";
  const temperature = params.get("temperature") ?? "";
  const dealer = params.get("dealer") ?? "";
  const search = params.get("search") ?? "";

  const [localSearch, setLocalSearch] = React.useState(search);
  React.useEffect(() => setLocalSearch(search), [search]);

  // `assignedDealerId` is a `users.id` UUID upstream and `ListLeadsDto` marks
  // it `@IsUUID()`. This used to be a free-text "Dealer id" box, so typing
  // anything at all sent a non-UUID and the backend answered
  // 400 "assignedDealerId must be a UUID" — the whole table blanked with
  // "Failed to load leads." on the first keystroke. Pick from the real roster
  // instead so only valid ids can ever be sent.
  const usersQuery = useUsers();
  const assignees = React.useMemo(
    () =>
      (usersQuery.data?.data ?? [])
        .slice()
        .sort((a, b) => a.email.localeCompare(b.email)),
    [usersQuery.data],
  );

  // 300ms debounce on search.
  React.useEffect(() => {
    if (localSearch === search) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (localSearch) next.set("search", localSearch);
      else next.delete("search");
      next.set("page", "1");
      router.push(`${pathname}?${next.toString()}`);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  function clearAll() {
    router.push(pathname);
  }

  const anyActive = stage || temperature || dealer || search;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-2">
      <label className="flex min-w-[13rem] flex-1 flex-col gap-1">
        <span className={FIELD_LABEL}>Search</span>
        <span className="relative block">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Name or phone"
            aria-label="Search leads by name or phone"
            className="pl-7"
          />
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className={FIELD_LABEL}>Stage</span>
        <Select
          value={stage}
          onChange={(e) => setParam("stage", e.target.value)}
          aria-label="Filter by stage"
          className="w-44"
        >
          <option value="">All stages</option>
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {stageLabel(s)}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={FIELD_LABEL}>Temperature</span>
        <Select
          value={temperature}
          onChange={(e) => setParam("temperature", e.target.value)}
          aria-label="Filter by temperature"
          className="w-32"
        >
          <option value="">All temps</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={FIELD_LABEL}>Dealer</span>
        <Select
          value={dealer}
          onChange={(e) => setParam("dealer", e.target.value)}
          aria-label="Filter by dealer"
          className="w-52"
          disabled={usersQuery.isLoading}
        >
          <option value="">
            {usersQuery.isError ? "Roster unavailable" : "All dealers"}
          </option>
          {assignees.map((u) => (
            <option key={u.id} value={u.id}>
              {userLabel(u.email)} · {u.role.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </label>

      {anyActive ? (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}
