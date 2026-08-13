"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/lib/learn";

/**
 * The program's gates as the page's top bar: one dated stop per stage, filled
 * behind you and hollow ahead, each one a jump to the stage it names.
 *
 * It replaces the milestone list that used to sit halfway down the page. A list
 * that far in answers "what's left" only after you've scrolled past everything
 * it's about; pinned to the top it answers before, during and after, and pays
 * for its height by doubling as the table of contents.
 *
 * Nothing is ticked here. Every stop mirrors the proof goal inside its stage,
 * and clicking takes you there — two places to tick the same thing is two
 * places to wonder which one counted.
 *
 * The line above the rail carries the one thing a compressed stop can't: the
 * proof text. It reads the stage you're on until you point at another, so the
 * rail can be walked without leaving the page or losing your place in it.
 */
export function MilestoneNav({ milestones }: { milestones: Milestone[] }) {
  const [pointed, setPointed] = useState<string | null>(null);

  // One stop is a label, not a rail — the stage block says the same thing
  // better a screen down.
  if (milestones.length < 2) return null;

  const doneCount = milestones.filter((m) => m.done).length;
  const focus =
    milestones.find((m) => m.id === pointed) ??
    milestones.find((m) => m.current) ??
    milestones[milestones.length - 1];
  const last = milestones.length - 1;

  return (
    <nav
      aria-label="Milestones"
      // Sticky from md up only: below that the shell's own header owns the top
      // of the viewport, and two bars stacked there would eat the screen.
      className="-mx-4 border-b border-line bg-bg px-4 md:sticky md:top-0 md:z-20 md:-mx-8 md:px-8"
    >
      <div className="flex items-baseline justify-between gap-4 pt-3">
        {/* Hidden from assistive tech: every word of it is already in the stop's
            own label below, and read twice it's just noise. */}
        <p aria-hidden className="min-w-0 truncate text-[13px] text-muted">
          <span className={cn("font-medium", focus.done ? "text-muted" : "text-ink")}>
            {focus.title}
          </span>
          {focus.proof && (
            <>
              <span className="px-1.5 text-faint">·</span>
              {focus.proof}
            </>
          )}
        </p>
        <p className="shrink-0 font-mono text-xs tabular-nums text-faint">
          {doneCount}/{milestones.length} cleared
        </p>
      </div>

      <div className="relative">
        <ol
          className="scrollbar-none flex overflow-x-auto pb-3 pt-2"
          onMouseLeave={() => setPointed(null)}
        >
          {milestones.map((milestone, index) => {
            // The segment behind a stop lights when the stop before it is
            // cleared, so the rail fills left to right as ground covered.
            const litBefore = index > 0 && milestones[index - 1].done;
            const here = milestone.current && !milestone.done;

            return (
              <li key={milestone.id} className="flex min-w-27 flex-1 flex-col sm:min-w-0">
                <a
                  href={`#stage-${milestone.id}`}
                  onMouseEnter={() => setPointed(milestone.id)}
                  onFocus={() => setPointed(milestone.id)}
                  onBlur={() => setPointed(null)}
                  className="block cursor-pointer rounded-md py-1 transition-colors duration-150 ease-mac hover:bg-raised/40 motion-reduce:transition-none"
                >
                  <span aria-hidden className="flex items-center">
                    <span
                      className={cn(
                        "h-px flex-1 transition-colors duration-200 ease-mac motion-reduce:transition-none",
                        index === 0
                          ? "bg-transparent"
                          : litBefore
                            ? "bg-primary/60"
                            : "bg-line"
                      )}
                    />
                    <span
                      className={cn(
                        "block size-3 shrink-0 rotate-45 transition-colors duration-200 ease-mac motion-reduce:transition-none",
                        // The capstone is a diamond, every other stage a circle:
                        // shape carries the difference, not colour alone.
                        milestone.capstone ? "rounded-[3px]" : "rounded-full",
                        milestone.done
                          ? "bg-primary"
                          : here
                            ? "bg-surface ring-2 ring-inset ring-primary/70"
                            : "bg-raised ring-1 ring-inset ring-line-strong"
                      )}
                    />
                    <span
                      className={cn(
                        "h-px flex-1 transition-colors duration-200 ease-mac motion-reduce:transition-none",
                        index === last
                          ? "bg-transparent"
                          : milestone.done
                            ? "bg-primary/60"
                            : "bg-line"
                      )}
                    />
                  </span>

                  <span
                    className={cn(
                      "mt-2 flex items-center justify-center gap-1 px-1 text-[13px] font-medium transition-colors duration-150 motion-reduce:transition-none",
                      here ? "text-ink" : "text-muted"
                    )}
                  >
                    {milestone.capstone && (
                      <Flag className="size-3 shrink-0 text-primary-dim" aria-hidden />
                    )}
                    <span className="truncate">{milestone.title}</span>
                  </span>
                  {/* Held open even when undated, so the rail keeps one baseline. */}
                  <span className="mt-0.5 block truncate px-1 text-center font-mono text-[11px] tabular-nums text-faint">
                    {milestone.day ?? " "}
                  </span>

                  <span className="sr-only">
                    {milestone.proof ? `${milestone.proof}. ` : ""}
                    {milestone.done
                      ? "cleared"
                      : here
                        ? "you are here, not cleared yet"
                        : "not cleared yet"}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
        {/* The rail scrolls on a phone; the fade is what says so, since the
            scrollbar is hidden. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-bg sm:hidden"
        />
      </div>
    </nav>
  );
}
