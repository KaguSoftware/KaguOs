"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * KaguOs numeric field — digits only while typing (one decimal separator,
 * comma accepted and normalized to a dot), monospace, right-aligned,
 * normalized to fixed decimals on blur. Optional unit suffix.
 */
export function NumberInput({
  name,
  id,
  defaultValue = "",
  placeholder = "0",
  decimals = 2,
  suffix,
  className,
  onValueChange,
  onCommit,
}: {
  name: string;
  id?: string;
  defaultValue?: string | number;
  placeholder?: string;
  decimals?: number;
  suffix?: string;
  className?: string;
  /** Notified with the cleaned string on every keystroke. FormData still works. */
  onValueChange?: (value: string) => void;
  /**
   * Notified on blur, AFTER normalisation — the value the user settled on.
   * Use this for save-on-blur; `onValueChange` fires mid-typing, where "1" is a
   * legitimate keystroke on the way to "12" and saving it would be wrong.
   */
  onCommit?: (value: string) => void;
}) {
  const [value, setValue] = useState(String(defaultValue ?? ""));

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    let next = event.target.value.replace(/,/g, ".");
    next = next.replace(/[^0-9.]/g, "");
    const firstDot = next.indexOf(".");
    if (firstDot !== -1) {
      next =
        next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, "");
    }
    setValue(next);
    onValueChange?.(next);
  }

  function handleBlur() {
    if (!value.trim()) {
      onCommit?.("");
      return;
    }
    const parsed = Number(value);
    const settled = Number.isFinite(parsed) ? parsed.toFixed(decimals) : value;
    if (settled !== value) setValue(settled);
    onCommit?.(settled);
  }

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-md border border-line bg-raised px-3 text-right font-mono text-sm text-ink placeholder:text-muted",
          "transition-colors duration-150 hover:border-line-strong focus-visible:border-line-strong",
          suffix && "pr-12"
        )}
      />
      {suffix && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs text-faint"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
