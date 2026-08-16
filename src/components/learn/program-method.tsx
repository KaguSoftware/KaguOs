"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SprintPractice } from "@/lib/types";

/**
 * How to actually run the program: the study rules, and the shape of one day.
 *
 * Rules are a definition list, not a card grid — six identical icon cards is
 * the banned shape, and the rules are label-plus-explanation anyway, which is
 * exactly what a definition list is for.
 *
 * Collapsed by default: this is the method you read once and then live by, so
 * it shouldn't sit between you and the goals you came to tick. The closed row
 * still says what's inside — rule count and hours a day — so opening it is a
 * choice, not a lucky guess.
 */
export function ProgramMethod({
  rules,
  session,
}: {
  rules: SprintPractice[];
  session: SprintPractice[];
}) {
  const [open, setOpen] = useState(false);
  const totalMinutes = session.reduce((n, s) => n + (s.minutes ?? 0), 0);

  const summary = [
    rules.length > 0 && `${rules.length} rule${rules.length === 1 ? "" : "s"}`,
    totalMinutes > 0 && `${formatMinutes(totalMinutes)} a day`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="program-method-body"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-150 hover:bg-raised/50",
            open && "rounded-b-none border-b border-line"
          )}
        >
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="text-sm font-semibold text-ink">
              How to actually learn this
            </span>
            {summary && (
              <span className="font-mono text-xs text-faint">{summary}</span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-faint transition-transform duration-150 ease-mac motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </button>
      </h2>

      {open && <MethodBody rules={rules} session={session} totalMinutes={totalMinutes} />}
    </>
  );
}

function MethodBody({
  rules,
  session,
  totalMinutes,
}: {
  rules: SprintPractice[];
  session: SprintPractice[];
  totalMinutes: number;
}) {
  return (
    <div id="program-method-body" className="grid gap-6 p-3.5 sm:p-4">
      {rules.length > 0 && (
        <dl className="grid divide-y divide-line">
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className={cn(
                "grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[7.5rem_1fr]",
                index === 0 && "pt-0",
                index === rules.length - 1 && "pb-0"
              )}
            >
              <dt className="font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-primary-dim">
                {rule.label}
              </dt>
              <dd className="min-w-0">
                {rule.title && (
                  <p className="text-[calc(13px*var(--text-scale,1))] font-medium text-ink">{rule.title}</p>
                )}
                {rule.body && (
                  <p className="mt-0.5 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
                    {rule.body}
                  </p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {session.length > 0 && totalMinutes > 0 && (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className="text-[calc(13px*var(--text-scale,1))] font-medium text-ink">One day, blocked out</h3>
            <p className="font-mono text-xs text-faint">
              {formatMinutes(totalMinutes)} a day
            </p>
          </div>

          {/* The meter is proportional: the 40-minute blocks are visibly four
              times the 10-minute break, so the shape of the day is the thing
              you read, not five equal boxes with different numbers in them. */}
          <div
            className="flex gap-[3px]"
            role="img"
            aria-label={session
              .map((s) => `${s.label} ${s.minutes} minutes`)
              .join(", ")}
          >
            {session.map((block) => (
              <span
                key={block.id}
                style={{ flexGrow: block.minutes ?? 1 }}
                className={cn(
                  "h-2 rounded-full",
                  isBreak(block) ? "bg-raised" : "bg-primary/70"
                )}
              />
            ))}
          </div>

          <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
            {session.map((block) => (
              <li key={block.id} className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 translate-y-px rounded-[2px]",
                    isBreak(block) ? "bg-raised" : "bg-primary/70"
                  )}
                />
                <span className="min-w-0">
                  <span className="font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-muted">
                    {block.label}
                  </span>
                  <span className="ml-1.5 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
                    {block.minutes}m
                  </span>
                  {block.body && (
                    <span className="block max-w-[24ch] text-xs leading-snug text-faint">
                      {block.body}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The one block that isn't work — drawn as a gap in the day, not a colour. */
function isBreak(block: SprintPractice) {
  return /break/i.test(block.label);
}

function formatMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const hours = total / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hrs`;
}
