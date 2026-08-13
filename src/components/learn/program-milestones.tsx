import { Check, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/lib/learn";
import type { SprintPractice } from "@/lib/types";

/**
 * The proof points, as a dated list you either have or haven't.
 *
 * Nothing is ticked here: every row mirrors the proof goal inside its stage,
 * and each is a link back to it. Two places to tick the same thing is two
 * places to wonder which one counted.
 */
export function ProgramMilestones({
  milestones,
  build,
}: {
  milestones: Milestone[];
  /** The capstone's build timeline, if the program has one. */
  build: SprintPractice[];
}) {
  if (milestones.length === 0 && build.length === 0) return null;

  return (
    <div className="grid gap-5 p-3.5 sm:p-4">
      {milestones.length > 0 && (
        <ul className="grid divide-y divide-line">
          {milestones.map((milestone, index) => (
            <li
              key={milestone.id}
              className={cn(index === 0 && "pt-0", index === milestones.length - 1 && "pb-0")}
            >
              <a
                href={`#stage-${milestone.id}`}
                className="-mx-1.5 flex items-start gap-3 rounded-md px-1.5 py-2.5 transition-colors duration-150 hover:bg-raised/50"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-px flex size-[18px] shrink-0 items-center justify-center transition-colors duration-150",
                    milestone.capstone ? "rotate-45 rounded-[4px]" : "rounded-full",
                    milestone.done
                      ? "bg-primary text-primary-ink"
                      : "border border-line-strong bg-surface"
                  )}
                >
                  {milestone.done && (
                    <Check className={cn("size-2.5", milestone.capstone && "-rotate-45")} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[13px] font-medium",
                        milestone.done ? "text-muted" : "text-ink"
                      )}
                    >
                      {milestone.capstone && (
                        <Flag className="size-3 shrink-0 text-primary-dim" aria-hidden />
                      )}
                      {milestone.title}
                    </span>
                    {milestone.day !== null && (
                      <span className="font-mono text-[11px] tabular-nums text-faint">
                        day {milestone.day}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block max-w-[70ch] text-[13px] leading-relaxed text-muted">
                    {milestone.proof}
                  </span>
                </span>

                <span className="sr-only">
                  {milestone.done ? "cleared" : "not cleared yet"}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {build.length > 0 && (
        <section className={cn(milestones.length > 0 && "border-t border-line pt-4")}>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
            Capstone build timeline
          </h3>
          <ul className="grid gap-1.5">
            {build.map((step) => (
              <li key={step.id} className="flex items-baseline gap-3">
                <span className="w-8 shrink-0 font-mono text-[11px] tabular-nums text-primary-dim">
                  {step.label}
                </span>
                <span className="min-w-0 max-w-[70ch] text-[13px] leading-relaxed text-muted">
                  {step.body ?? step.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
