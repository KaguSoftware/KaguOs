"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SprintGoal } from "@/lib/types";

export type RacePerson = { id: string; name: string; color: string };

/**
 * Team progress as a race: identical lanes, one finish line, order = standing.
 * Each lane says what that person is on right now; clicking it expands their
 * full goal checklist. Lane swaps animate FLIP-style (measured, transform-only)
 * so overtaking someone is visible without being a game. Quiet on purpose —
 * no badges, no confetti; the only reward for leading is being first.
 */
export function RaceStandings({
  participants,
  goals,
  done,
  meId,
}: {
  participants: RacePerson[];
  /** In sprint order — "on · <goal>" follows this order. */
  goals: SprintGoal[];
  /** keys of the form `${goalId}:${userId}` */
  done: Set<string>;
  meId: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const prevTops = useRef(new Map<string, number>());

  // FLIP: when a tick changes the standing, each moved lane animates from its
  // previous offset to its new one. Measured per render, transform-only.
  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const [id, el] of rowRefs.current) {
      const top = el.offsetTop;
      const prev = prevTops.current.get(id);
      if (!reduce && prev !== undefined && prev !== top) {
        el.animate(
          [{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }],
          { duration: 200, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
        );
      }
      prevTops.current.set(id, top);
    }
  });

  const goalCount = goals.length;
  const countOf = (personId: string) =>
    goals.filter((g) => done.has(`${g.id}:${personId}`)).length;

  // Standing order: most done first, ties by name so the order is stable.
  const standing = [...participants].sort(
    (a, b) => countOf(b.id) - countOf(a.id) || a.name.localeCompare(b.name)
  );
  // Competition ranking: equal counts share a rank (1, 1, 3, …).
  const rank = new Map<string, number>();
  standing.forEach((p, i) => {
    const prev = standing[i - 1];
    rank.set(
      p.id,
      i > 0 && prev && countOf(prev.id) === countOf(p.id)
        ? (rank.get(prev.id) ?? i + 1)
        : i + 1
    );
  });

  function firstName(name: string) {
    return name.split(" ")[0];
  }

  return (
    <ul className="px-2 py-2">
      {standing.map((person) => {
        const count = countOf(person.id);
        const pct = goalCount > 0 ? (count / goalCount) * 100 : 0;
        const isMe = person.id === meId;
        const isOpen = expanded.has(person.id);
        const current = goals.find((g) => !done.has(`${g.id}:${person.id}`));
        const status =
          goalCount === 0 ? null : current ? `on · ${current.title}` : "finished";

        return (
          <li
            key={person.id}
            ref={(el) => {
              if (el) rowRefs.current.set(person.id, el);
              else rowRefs.current.delete(person.id);
            }}
            className={cn("rounded-md", isMe && "bg-raised/40")}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(person.id)) next.delete(person.id);
                  else next.add(person.id);
                  return next;
                })
              }
              // Two rows on a phone, one on a laptop. Side by side at 390px the
              // name column is 80px carrying BOTH the name and "on · <goal>",
              // so every status truncated to "on · Chat vs …" while the lane
              // beside it had 250px doing nothing. Stacking gives the sentence
              // the full width and the lane its own line.
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-2 py-2.5 text-left transition-colors duration-150 hover:bg-raised/60 sm:flex-nowrap"
            >
              <span className="w-4 shrink-0 text-right font-mono text-xs text-faint">
                {rank.get(person.id)}
              </span>
              {/* flex-1 on the phone so the name+status take the row; fixed
                  width from sm up, where the lane sits beside them. */}
              <span className="min-w-0 flex-1 sm:w-28 sm:flex-none">
                <span
                  style={{ color: person.color }}
                  className="block truncate text-[calc(13px*var(--text-scale,1))] font-medium"
                  title={person.name}
                >
                  {isMe ? "You" : firstName(person.name)}
                </span>
                {status && (
                  <span className="mt-0.5 block truncate text-xs text-faint">
                    {status}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted sm:order-last sm:w-9 sm:text-right">
                {count}/{goalCount}
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 text-faint transition-transform duration-150 ease-mac motion-reduce:transition-none sm:order-last",
                  isOpen && "rotate-180"
                )}
              />
              <span
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={goalCount}
                aria-valuenow={count}
                aria-label={`${person.name}: ${count} of ${goalCount} goals done`}
                // Full width on its own row below the name; back in line from sm.
                className="relative order-last h-1.5 w-full min-w-0 rounded-full bg-raised sm:order-0 sm:w-auto sm:flex-1"
              >
                {/* The finish line — same spot for everyone. */}
                <span
                  aria-hidden
                  className="absolute inset-y-[-3px] right-0 w-px bg-line-strong"
                />
                <span
                  style={{ width: `${pct}%`, backgroundColor: person.color }}
                  className="block h-full rounded-full transition-[width] duration-200 ease-mac motion-reduce:transition-none"
                />
              </span>
            </button>

            {isOpen && goalCount > 0 && (
              <ul className="space-y-1 pb-2.5 pl-9 pr-8">
                {goals.map((goal) => {
                  const goalDone = done.has(`${goal.id}:${person.id}`);
                  const isCurrent = current?.id === goal.id;
                  return (
                    <li
                      key={goal.id}
                      className="flex items-center gap-2 text-[calc(13px*var(--text-scale,1))]"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center",
                          goalDone ? "text-primary-dim" : "text-line-strong"
                        )}
                      >
                        {goalDone ? <Check className="size-3.5" /> : "·"}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 truncate",
                          goalDone ? "text-muted" : "text-ink"
                        )}
                      >
                        {goal.title}
                      </span>
                      {isCurrent && (
                        <span className="shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
                          now
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
