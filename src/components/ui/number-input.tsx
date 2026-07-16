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
}: {
  name: string;
  id?: string;
  defaultValue?: string | number;
  placeholder?: string;
  decimals?: number;
  suffix?: string;
  className?: string;
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
  }

  function handleBlur() {
    if (!value.trim()) return;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setValue(parsed.toFixed(decimals));
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
