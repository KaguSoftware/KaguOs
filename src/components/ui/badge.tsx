import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "green" | "amber" | "danger" | "info" | "faint";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line-strong text-muted",
  green: "border-primary/25 bg-primary/10 text-primary-dim",
  amber: "border-amber/25 bg-amber/10 text-amber",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/25 bg-info/10 text-info",
  faint: "border-line text-faint",
};

const base =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium";

/**
 * A status pill. Given an `onClick` it becomes the control for the status it
 * shows — the state and the switch are the same thing, so there's no separate
 * button to hunt for. Without one it stays an inert `<span>`.
 */
export function Badge({
  tone = "neutral",
  className,
  children,
  onClick,
  title,
  disabled,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        disabled={disabled}
        className={cn(
          base,
          tones[tone],
          "transition-colors duration-150 hover:brightness-125 disabled:pointer-events-none disabled:opacity-50",
          className
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <span className={cn(base, tones[tone], className)} title={title}>
      {children}
    </span>
  );
}
