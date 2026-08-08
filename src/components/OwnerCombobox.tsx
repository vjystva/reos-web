"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  filterOwners,
  ownerLabel,
  ownerSubLabel,
  type TaskOwnerOption,
} from "@/lib/taskBoard";

interface OwnerComboboxProps {
  id: string;
  /** Already role-filtered + sorted — see `taskOwnerOptions`. */
  users: readonly TaskOwnerOption[];
  /** Selected user id, or "" for none. */
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  /** Label for the "no selection" choice; omit to hide that row. */
  emptyOptionLabel?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Searchable single-select owner picker.
 *
 * Built on a plain `Input` + listbox rather than a combobox dependency —
 * `cmdk`/Radix Select are not in this project and the fix does not justify a
 * new package. Typing filters by the *derived display name* (`Asha Rao`) as
 * well as the email, which is the PM ask: the tenant user list is long and
 * `users` has no `name` column to search on directly.
 *
 * Keyboard: ↑/↓ move, Enter picks, Esc closes, Tab closes and commits nothing.
 */
export function OwnerCombobox({
  id,
  users,
  value,
  onChange,
  placeholder = "Search by name…",
  emptyOptionLabel,
  className,
  required,
  disabled,
}: OwnerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const selected = React.useMemo(
    () => users.find((u) => u.id === value) ?? null,
    [users, value],
  );

  const matches = React.useMemo(
    () => filterOwners(users, query),
    [users, query],
  );

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keep the active row in view while arrowing through a long list.
  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    // Guarded: jsdom (and older browsers) do not implement scrollIntoView, and
    // keeping a row visible is never worth throwing over.
    if (typeof node?.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  function openList() {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(0);
  }

  function commit(userId: string) {
    onChange(userId);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches[activeIndex];
      if (pick) commit(pick.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    } else if (e.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  const listboxId = `${id}-listbox`;
  // Closed: show the selection. Open: show what the user is typing.
  const displayValue = open ? query : selected ? ownerLabel(selected) : "";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          id={id}
          ref={inputRef}
          role="combobox"
          type="text"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          aria-required={required}
          disabled={disabled}
          value={displayValue}
          placeholder={selected && !open ? ownerLabel(selected) : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onFocus={openList}
          onKeyDown={handleKeyDown}
          className="pr-12"
        />

        <div className="absolute right-1 top-0 flex h-8 items-center gap-0.5">
          {selected && !disabled ? (
            <button
              type="button"
              aria-label="Clear owner"
              title="Clear owner"
              onClick={() => {
                onChange("");
                setQuery("");
                inputRef.current?.focus();
              }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
          <ChevronDown
            className="h-3 w-3 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>

      {/*
        The real form value. Keeping a hidden input means `required` still
        participates in native validation and the field is readable by tests
        and by any surrounding FormData consumer.
      */}
      <input type="hidden" name={id} value={value} />

      {open ? (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Owners"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {emptyOptionLabel ? (
            <li
              role="option"
              aria-selected={value === ""}
              onMouseDown={(e) => {
                e.preventDefault();
                commit("");
              }}
              className="cursor-pointer px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              {emptyOptionLabel}
            </li>
          ) : null}

          {matches.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              No owner matches “{query}”
            </li>
          ) : (
            matches.map((u, index) => {
              const isActive = index === activeIndex;
              const isSelected = u.id === value;
              return (
                <li
                  key={u.id}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    // mousedown, not click — the input's blur would otherwise
                    // close the list before the click lands.
                    e.preventDefault();
                    commit(u.id);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 px-2 py-1.5",
                    isActive && "bg-accent",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-foreground">
                      {ownerLabel(u)}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {ownerSubLabel(u)}
                    </span>
                  </span>
                  {isSelected ? (
                    <Check
                      className="h-3 w-3 shrink-0 text-foreground"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
