import { cn } from "@/lib/utils";

/**
 * How much of the pack is answered.
 *
 * A bar rather than a number alone, because the honest thing this has to
 * communicate is "you are two thirds of the way through a long job" — and a
 * bare "67%" reads as a score. The count beside it says what the percentage is
 * a percentage OF, which is the question everyone asks of a progress bar.
 *
 * Optional questions are excluded from both sides of the fraction upstream (see
 * progressOf in lib/intake.ts), so this can actually reach 100 for a business
 * that doesn't sell anything by the hour. A meter nobody can finish is a meter
 * everybody learns to ignore.
 */
export function ProgressMeter({
  pct,
  done,
  total,
  label,
  className,
}: {
  pct: number;
  done: number;
  total: number;
  label?: string;
  className?: string;
}) {
  const complete = total > 0 && done === total;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Input pack completion"}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-mac",
            complete ? "bg-primary" : "bg-primary-dim"
          )}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-xs tabular-nums text-faint">
        {done}/{total}
      </span>
    </div>
  );
}
