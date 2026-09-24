import { cn } from "@/lib/utils";

/**
 * Text that rises out of its own mask when it mounts — the StaggeredMenu reveal
 * (see DESIGN.md → Motion). The outer span is the mask; pb gives descenders
 * room so it doesn't clip them. No hooks, so server components can use it.
 */
export function RiseText({
  delay = 0,
  duration = 650,
  className,
  innerClassName,
  children,
}: {
  delay?: number;
  duration?: number;
  /** On the mask — layout, margins, truncation width. */
  className?: string;
  /** On the moving line — type styles. */
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("block overflow-hidden pb-[0.08em]", className)}>
      <span
        className={cn(
          "block origin-bottom motion-safe:animate-[line-rise_var(--rise-d)_var(--ease-mac)_both]",
          innerClassName
        )}
        style={
          {
            animationDelay: `${delay}ms`,
            "--rise-d": `${duration}ms`,
          } as React.CSSProperties
        }
      >
        {children}
      </span>
    </span>
  );
}

/** The short accent rule that draws in under a display title. */
export function AccentRule({ color, delay = 180 }: { color: string; delay?: number }) {
  return (
    <span
      aria-hidden
      className="mt-3 block h-[3px] w-12 origin-left rounded-full motion-safe:animate-[wipe-x_500ms_var(--ease-mac)_both]"
      style={{ backgroundColor: color, animationDelay: `${delay}ms` }}
    />
  );
}
