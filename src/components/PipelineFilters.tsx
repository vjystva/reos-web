"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LEAD_STAGES } from "@/types/api";
import { stageLabel } from "@/lib/utils";

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
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        <span>Stage</span>
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
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        <span>Temperature</span>
        <Select
          value={temperature}
          onChange={(e) => setParam("temperature", e.target.value)}
          aria-label="Filter by temperature"
          className="w-36"
        >
          <option value="">All temps</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        <span>Dealer</span>
        <Input
          value={dealer}
          onChange={(e) => setParam("dealer", e.target.value)}
          placeholder="Dealer id"
          aria-label="Filter by dealer id"
          className="w-44"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        <span>Search</span>
        <Input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Name or phone"
          aria-label="Search leads by name or phone"
          className="w-56"
        />
      </label>
      {anyActive ? (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}
