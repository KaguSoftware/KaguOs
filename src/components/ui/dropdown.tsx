"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { usePopoverSide } from "@/lib/use-popover-side";
import { cn } from "@/lib/utils";

export type DropdownOption = {
  value: string;
  label: string;
  hint?: string;
};

/**
 * KaguOs custom dropdown — button + listbox popover, full keyboard support.
 * Carries its value through a hidden input so plain FormData forms work.
 */
export function Dropdown({
  name,
  id,
  options,
  defaultValue,
  value: controlledValue,
  onChange,
  placeholder = "Choose…",
  className,
  disabled,
  searchThreshold = 6,
  searchPlaceholder = "Filter…",
}: {
  name?: string;
  id?: string;
  options: DropdownOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Show a local filter box once the list is at least this long. 0 disables it. */
  searchThreshold?: number;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue ?? "");
  const value = controlledValue ?? internal;
  const [active, setActive] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value))
  );
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  // Open upward when the trigger is near the bottom of the window — otherwise
  // the menu lands below the fold and every pick costs a scroll.
  const side = usePopoverSide(rootRef, open);

  const searchable = searchThreshold > 0 && options.length >= searchThreshold;

  // Filter locally on label + hint. Instant, no network — the whole option set
  // is already in memory.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.hint?.toLowerCase().includes(q)
    );
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[active] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [open, active]);

  // Focusing the search box is a DOM side-effect, so it stays in an effect —
  // but the state resets (query/active) happen in setOpenState below, NOT here,
  // to avoid a setState-in-effect cascade (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  // Keep the highlighted row valid as the filtered list shrinks/grows. Done
  // DURING RENDER (tracking the previous length), not in an effect — the same
  // pattern the rest of the app uses to avoid a stale paint. See HANDOFF perf note.
  const [seenLen, setSeenLen] = useState(filtered.length);
  if (seenLen !== filtered.length) {
    setSeenLen(filtered.length);
    if (active > filtered.length - 1) setActive(Math.max(0, filtered.length - 1));
  }

  // Single entry point for open/close so the on-open resets live here, not in an
  // effect. Opening clears the filter and points the highlight at the selection.
  function setOpenState(next: boolean) {
    if (next) {
      setQuery("");
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    }
    setOpen(next);
  }

  function select(option: DropdownOption) {
    setInternal(option.value);
    onChange?.(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        if (open) {
          const option = filtered[active];
          if (option) select(option);
        } else {
          setOpenState(true);
        }
        break;
      case " ":
        // Space types into the search box when it's focused; only toggles the
        // menu when we're not searching (otherwise you can't type a space).
        if (!searchable || !open) {
          event.preventDefault();
          setOpenState(!open);
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpenState(true);
        else setActive((i) => Math.min(filtered.length - 1, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open) setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        if (open && !searchable) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open && !searchable) {
          event.preventDefault();
          setActive(filtered.length - 1);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpenState(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-raised px-3 text-left text-sm transition-colors duration-150",
          "hover:border-line-strong disabled:pointer-events-none disabled:opacity-50",
          selected ? "text-ink" : "text-muted"
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-faint transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-10 w-full animate-pop-in overflow-hidden rounded-md border border-line bg-raised/90 shadow-lg shadow-black/40 backdrop-blur-md",
            side === "top"
              ? "bottom-full mb-1 origin-bottom"
              : "top-full mt-1 origin-top"
          )}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-line px-2.5">
              <Search className="size-3.5 shrink-0 text-faint" aria-hidden />
              <input
                ref={searchRef}
                data-no-ring
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Filter options"
                aria-controls={listboxId}
                className="h-8 w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-activedescendant={
              filtered[active] ? `${listboxId}-${active}` : undefined
            }
            className="max-h-56 overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-faint" role="presentation">
                No matches.
              </li>
            )}
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(option)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm",
                    index === active ? "bg-surface text-ink" : "text-muted"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="block truncate text-xs text-faint">
                        {option.hint}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <Check className="size-3.5 shrink-0 text-primary-dim" aria-hidden />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Multi-select sibling of Dropdown — same button + popover shell, same keyboard
 * model, but the menu stays OPEN on pick and toggles values in a list.
 *
 * Separate component rather than a `multi` flag on Dropdown: the two differ in
 * value type (string vs string[]), in close-on-select, and in what the trigger
 * reads. Threading all three through one component makes every existing
 * single-select call site pay for a mode it never uses.
 *
 * Empty array means "no filter" (i.e. everything), which is what every caller
 * on the debug board wants — a filter nobody has touched shouldn't hide rows.
 */
export function MultiDropdown({
  id,
  options,
  values,
  onChange,
  /** Trigger text when nothing is picked — reads as "no filter applied". */
  placeholder,
  /** Plural noun for the "3 projects" summary once several are picked. */
  summaryNoun,
  label,
  className,
  disabled,
  searchThreshold = 6,
  searchPlaceholder = "Filter…",
}: {
  id?: string;
  options: DropdownOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  summaryNoun: string;
  /** Accessible name — the trigger's own text is a value, not a label. */
  label: string;
  className?: string;
  disabled?: boolean;
  searchThreshold?: number;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const side = usePopoverSide(rootRef, open);

  const searchable = searchThreshold > 0 && options.length >= searchThreshold;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[active] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [open, active]);

  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  // Same during-render clamp as Dropdown — keeps the highlight valid as the
  // filtered list shrinks, without a setState-in-effect cascade.
  const [seenLen, setSeenLen] = useState(filtered.length);
  if (seenLen !== filtered.length) {
    setSeenLen(filtered.length);
    if (active > filtered.length - 1) setActive(Math.max(0, filtered.length - 1));
  }

  function setOpenState(next: boolean) {
    if (next) {
      setQuery("");
      setActive(0);
    }
    setOpen(next);
  }

  /** Toggle one value, keeping the menu open so several can be picked at once. */
  function toggle(option: DropdownOption) {
    onChange(
      values.includes(option.value)
        ? values.filter((v) => v !== option.value)
        : [...values, option.value]
    );
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        if (open) {
          const option = filtered[active];
          if (option) toggle(option);
        } else {
          setOpenState(true);
        }
        break;
      case " ":
        if (!searchable || !open) {
          event.preventDefault();
          setOpenState(!open);
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpenState(true);
        else setActive((i) => Math.min(filtered.length - 1, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open) setActive((i) => Math.max(0, i - 1));
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  // One pick reads as itself; several collapse to a count, so the trigger never
  // grows past its column ("Pet app, Site, Ledger…" is unreadable at w-36).
  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? placeholder)
        : `${values.length} ${summaryNoun}`;

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpenState(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={
          values.length > 0 ? `${label}: ${summary}` : `${label}: any`
        }
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-raised px-3 text-left text-sm transition-colors duration-150",
          "hover:border-line-strong disabled:pointer-events-none disabled:opacity-50",
          values.length > 0 ? "text-ink" : "text-muted"
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-faint transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-10 w-full min-w-44 animate-pop-in overflow-hidden rounded-md border border-line bg-raised/90 shadow-lg shadow-black/40 backdrop-blur-md",
            side === "top"
              ? "bottom-full mb-1 origin-bottom"
              : "top-full mt-1 origin-top"
          )}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-line px-2.5">
              <Search className="size-3.5 shrink-0 text-faint" aria-hidden />
              <input
                ref={searchRef}
                data-no-ring
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Filter options"
                aria-controls={listboxId}
                className="h-8 w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable
            aria-activedescendant={
              filtered[active] ? `${listboxId}-${active}` : undefined
            }
            className="max-h-56 overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-faint" role="presentation">
                No matches.
              </li>
            )}
            {filtered.map((option, index) => {
              const isSelected = values.includes(option.value);
              return (
                <li
                  key={option.value}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => toggle(option)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm",
                    index === active ? "bg-surface text-ink" : "text-muted"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="block truncate text-xs text-faint">
                        {option.hint}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <Check
                      className="size-3.5 shrink-0 text-primary-dim"
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {values.length > 0 && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange([])}
              className="w-full border-t border-line px-3 py-1.5 text-left text-xs text-muted transition-colors duration-150 hover:text-ink"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
