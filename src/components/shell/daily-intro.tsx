"use client";

import { useEffect, useState } from "react";
import { INTRO_COOKIE, INTRO_COOKIE_MAX_AGE } from "@/lib/intro-pref";

export type IntroHighlight = { value: number; label: string; where: string };

/** When it leaves on its own. A click or any key sends it sooner. */
const HOLD_MS = 1700;

/**
 * The first open of the day: the brand's hue wipes across, a big greeting
 * rises line by line with the day's few numbers, then the whole thing wipes
 * off to the left and the app is underneath. StaggeredMenu's entrance, used
 * once a day as a threshold — never on a navigation.
 *
 * The layout renders this only when the intro cookie isn't today's date, so it
 * covers the app from the first paint. Marking the day happens on mount, so a
 * refresh mid-intro doesn't replay it. Reduced motion hides it outright: it
 * would only be a two-second wall.
 */
export function DailyIntro({
  day,
  greeting,
  firstName,
  overdue,
  highlights,
}: {
  day: string;
  greeting: string;
  firstName: string;
  overdue: number;
  highlights: IntroHighlight[];
}) {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    document.cookie = `${INTRO_COOKIE}=${day}; path=/; max-age=${INTRO_COOKIE_MAX_AGE}; SameSite=Lax`;
    const leave = () => setPhase((p) => (p === "in" ? "out" : p));
    const timer = window.setTimeout(leave, HOLD_MS);
    window.addEventListener("keydown", leave);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", leave);
    };
  }, [day]);

  if (phase === "gone") return null;

  const lines = [`${greeting}${firstName ? "," : "."}`, ...(firstName ? [`${firstName}.`] : [])];
  const facts: { value: number; text: string; danger?: boolean }[] = [
    ...(overdue > 0
      ? [{ value: overdue, text: `overdue ${overdue === 1 ? "task" : "tasks"}`, danger: true }]
      : []),
    ...highlights.map((h) => ({ value: h.value, text: `${h.label} · ${h.where}` })),
  ];

  return (
    <div
      aria-hidden
      onClick={() => setPhase("out")}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && phase === "out") setPhase("gone");
      }}
      className={
        "fixed inset-0 z-[60] cursor-pointer overflow-hidden bg-bg motion-reduce:hidden " +
        (phase === "out" ? "animate-[wipe-out_420ms_var(--ease-mac-in)_both]" : "")
      }
    >
      {/* The layers sweep in from the right, then the surface lands on them. */}
      <div
        className="absolute inset-0 animate-[wipe-in_380ms_var(--ease-mac)_both]"
        style={{ backgroundColor: "color-mix(in oklch, var(--primary) 55%, transparent)" }}
      />
      <div className="absolute inset-0 bg-raised animate-[wipe-in_380ms_var(--ease-mac)_70ms_both]" />

      <div className="absolute inset-0 flex flex-col justify-center overflow-hidden bg-bg px-8 animate-[panel-in_480ms_var(--ease-mac)_160ms_both] md:px-20">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-primary/10 blur-3xl" />

        <div className="relative">
          {lines.map((line, i) => (
            <div key={i} className="overflow-hidden pb-[0.06em]">
              <p
                className="origin-bottom text-[clamp(56px,11vw,168px)] leading-[0.9] font-semibold uppercase tracking-[-0.055em] text-ink animate-[line-rise_750ms_var(--ease-mac)_both]"
                style={{ animationDelay: `${380 + i * 90}ms` }}
              >
                {line}
              </p>
            </div>
          ))}

          <span
            className="mt-8 block h-1 w-20 origin-left rounded-full bg-primary animate-[wipe-x_600ms_var(--ease-mac)_600ms_both]"
          />

          <ul className="mt-6 flex flex-col gap-2">
            {(facts.length ? facts : [{ value: 0, text: "Nothing overdue. Clear day." }]).map(
              (f, i) => (
                <li key={i} className="overflow-hidden">
                  <p
                    className="flex items-baseline gap-2.5 origin-bottom text-[calc(18px*var(--text-scale,1))] text-muted animate-[line-rise_600ms_var(--ease-mac)_both]"
                    style={{ animationDelay: `${640 + i * 70}ms` }}
                  >
                    {f.value > 0 && (
                      <span
                        className={
                          "font-mono text-[calc(22px*var(--text-scale,1))] font-medium tabular-nums " +
                          (f.danger ? "text-danger" : "text-ink")
                        }
                      >
                        {f.value}
                      </span>
                    )}
                    {f.text}
                  </p>
                </li>
              )
            )}
          </ul>
        </div>

        <p className="absolute bottom-8 right-8 text-[calc(12px*var(--text-scale,1))] text-faint animate-[page-in_400ms_var(--ease-mac)_900ms_both] md:right-20">
          Click or press any key
        </p>
      </div>
    </div>
  );
}
