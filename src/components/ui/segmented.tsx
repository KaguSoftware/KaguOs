"use client";

import { cn } from "@/lib/utils";

/**
 * A small set of mutually exclusive choices, all visible at once.
 *
 * The pattern already existed inline in the admin user row (the Role control);
 * this is the same shape extracted, because the language toggles need it in two
 * more places and three copies would drift. Not a Dropdown: these have two or
 * three options that are all worth seeing, and hiding the alternatives behind a
 * click is exactly wrong for a control whose job is "you can read this in
 * another language".
 *
 * Deliberately buttons in a `role="group"` rather than a radio group: the
 * options act immediately rather than staging a value for a submit, and a
 * radio's arrow-key semantics would promise a form that isn't there.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  disabled,
  className,
}: {
  options: readonly { key: T; label: string; short?: string; title?: string }[];
  value: T;
  onChange: (next: T) => void;
  /** Names the control for screen readers — it has no visible label of its own. */
  label: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex w-fit shrink-0 overflow-hidden rounded-md border border-line",
        className
      )}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            title={option.title ?? option.label}
            onClick={() => {
              if (!active) onChange(option.key);
            }}
            className={cn(
              "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
              size === "sm"
                ? "px-2.5 py-1 text-[calc(12px*var(--text-scale,1))]"
                : "px-3 py-1.5 text-[calc(13px*var(--text-scale,1))]",
              active ? "bg-raised font-medium text-ink" : "text-faint hover:text-muted"
            )}
          >
            {option.short ?? option.label}
          </button>
        );
      })}
    </div>
  );
}
