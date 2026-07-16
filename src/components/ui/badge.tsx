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

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
