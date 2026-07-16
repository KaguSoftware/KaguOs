import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.ComponentProps<"input">, "type" | "size"> & {
  /** Visible label text; renders the box + label as one clickable control. */
  label?: React.ReactNode;
  size?: "sm" | "md";
  /** Extra classes for the outer <label> wrapper. */
  className?: string;
};

const BOX = {
  sm: "size-4",
  md: "size-[1.125rem]",
} as const;

const ICON = {
  sm: "size-3",
  md: "size-3.5",
} as const;

/**
 * Custom checkbox: a real <input type="checkbox"> visually hidden under a
 * styled box, so it stays keyboard- and form-native. Works controlled
 * (checked/onChange) or uncontrolled (name/defaultChecked).
 *
 * The input is the `peer`; the box and the check icon are both following
 * siblings, so `peer-checked:` reaches each of them directly.
 */
export function Checkbox({
  label,
  size = "md",
  className,
  disabled,
  ...input
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "group inline-flex items-center gap-2 text-sm text-muted select-none",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        className
      )}
    >
      <span className={cn(BOX[size], "relative inline-grid shrink-0 place-items-center")}>
        <input
          type="checkbox"
          disabled={disabled}
          className="peer absolute inset-0 z-10 size-full cursor-[inherit] appearance-none rounded-[5px]"
          {...input}
        />
        {/* box */}
        <span
          aria-hidden
          className={cn(
            "col-start-1 row-start-1 size-full rounded-[5px] border border-line-strong bg-raised",
            "transition-[background-color,border-color] duration-150 ease-out",
            "group-hover:border-faint peer-disabled:group-hover:border-line-strong",
            "peer-checked:border-primary peer-checked:bg-primary",
            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-dim"
          )}
        />
        {/* check mark */}
        <Check
          aria-hidden
          className={cn(
            ICON[size],
            "pointer-events-none col-start-1 row-start-1 self-center justify-self-center text-primary-ink [stroke-width:3]",
            "scale-50 opacity-0 transition-[transform,opacity] duration-150 ease-out",
            "peer-checked:scale-100 peer-checked:opacity-100",
            "motion-reduce:transition-none"
          )}
        />
      </span>
      {label != null && <span className="min-w-0">{label}</span>}
    </label>
  );
}
