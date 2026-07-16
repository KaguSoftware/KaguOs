"use client";

import { Check } from "lucide-react";
import { MEMBER_COLORS } from "@/lib/colors";
import { cn } from "@/lib/utils";

/** Swatch grid for member identity colors (the only color control in KaguOs). */
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
  return (
    <div
      role="radiogroup"
      aria-label="Pick your color"
      className={cn("flex max-w-xs flex-wrap gap-1.5", className)}
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
  );
}
