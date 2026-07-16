"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { MEMBER_COLORS, isHexColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

/** Swatch grid for member identity colors, plus a custom-hex field. */
export function ColorPicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string | null;
  onChange: (key: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const customActive = !!value && isHexColor(value);
  const [hex, setHex] = useState(customActive ? value! : "");
  const trimmed = hex.trim();
  const canSubmit = isHexColor(trimmed) && !disabled;

  function submitHex() {
    if (!canSubmit) return;
    onChange(trimmed.toLowerCase());
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div
        role="radiogroup"
        aria-label="Pick your color"
        className="flex max-w-xs flex-wrap gap-1.5"
      >
        {MEMBER_COLORS.map((color) => {
          const selected = value === color.key;
          return (
            <button
              key={color.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={color.label}
              title={color.label}
              disabled={disabled}
              onClick={() => onChange(color.key)}
              style={{ backgroundColor: color.css }}
              className={cn(
                "flex size-6 items-center justify-center rounded-full transition-transform duration-150 ease-mac",
                "hover:scale-110 disabled:pointer-events-none disabled:opacity-50",
                selected && "ring-2 ring-ink ring-offset-2 ring-offset-surface"
              )}
            >
              {selected && <Check className="size-3 text-primary-ink" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          style={isHexColor(trimmed) ? { backgroundColor: trimmed } : undefined}
          className={cn(
            "size-6 shrink-0 rounded-full border border-line",
            isHexColor(trimmed) ? "border-transparent" : "bg-transparent",
            customActive && "ring-2 ring-ink ring-offset-2 ring-offset-surface"
          )}
        />
        <input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitHex();
            }
          }}
          placeholder="#7c5cff"
          maxLength={7}
          disabled={disabled}
          aria-label="Custom hex color"
          data-no-ring
          className="w-24 rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-ink placeholder:text-faint focus:border-line-strong focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submitHex}
          disabled={!canSubmit}
          aria-label="Use custom color"
          title="Use custom color"
          className="inline-flex size-6 items-center justify-center rounded-md border border-line-strong text-muted transition-colors duration-150 hover:border-primary hover:text-primary-dim disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-muted"
        >
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
