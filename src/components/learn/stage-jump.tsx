"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Flag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/lib/learn";

/**
 * The phone's answer to "where am I, and how do I get somewhere else".
 *
 * On a wide screen the milestone rail is pinned to the top of the page and does
 * this job all the way down: it says which stage you're on and every stop is a
 * jump. On a phone the rail is deliberately NOT sticky — the shell already owns
 * the top of the viewport, and two bars stacked there is most of a small screen
 * spent on chrome. So past the first screen the rail is simply gone, and a
 * program with six stages is three thousand pixels of scroll with nothing left
 * saying where in it you are.
 *
 * This is the same two answers moved to the bottom of the screen, where the
 * thumb already is: a pill that reads the stage you're on, and a sheet behind
 * it that lists all of them. It appears only once the rail has scrolled out of
 * view, so the two never say the same thing at the same time.
 *
 * Nothing is ticked here, exactly as on the rail — every stop mirrors the stage
 * it names and clicking takes you there. Two places to tick one thing is two
 * places to wonder which one counted.
 */
export function StageJump({ milestones }: { milestones: Milestone[] }) {
  const [open, setOpen] = useState(false);
  // Null until the observer reports: the pill must not flash in on load, when
  // the rail is the thing you're already looking at.
  const [railHidden, setRailHidden] = useState(false);

  // The pill is a function of the rail's visibility, so it's read from the rail
  // itself rather than from a scroll offset — no magic number to drift when the
  // header above it changes height.
  useEffect(() => {
    const rail = document.querySelector('nav[aria-label="Milestones"]');
    if (!rail) return;
    const io = new IntersectionObserver(
      ([entry]) => setRailHidden(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(rail);
    return () => io.disconnect();
  }, []);

  // One stop is a label, not a rail — same rule the milestone bar runs on.
  if (milestones.length < 2) return null;

  const cleared = milestones.filter((m) => m.done).length;
  const here =
    milestones.find((m) => m.current) ?? milestones[milestones.length - 1];
  const hereIndex = milestones.indexOf(here);

  function jump(id: string) {
    setOpen(false);
    const target = document.getElementById(`stage-${id}`);
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <>
      {/* Portaled to <body>, and that is load-bearing rather than tidiness: the
          page wrapper carries `animate-page-in` with fill-mode both, so its
          final `translateY(0)` sticks around forever — and ANY transform makes
          that element the containing block for `fixed` children. Rendered in
          place, the pill anchors to the bottom of the whole document instead of
          the bottom of the screen.

          Gating on `railHidden` also keeps createPortal off the server: it only
          ever flips inside an effect. md:hidden throughout — above that the
          rail is sticky and already does this job. */}
      {railHidden &&
        createPortal(
          <div
            // pointer-events-none on the wrapper so the strip of screen either
            // side of the pill stays tappable — a full-width invisible bar over
            // the last rows of the page would eat every tap that missed.
            className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
          >
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border border-line-strong bg-raised/90 py-2 pl-2 pr-3.5 shadow-lg backdrop-blur-md transition-transform duration-150 ease-mac active:scale-[0.98] motion-safe:animate-[sheet-up_180ms_var(--ease-mac)_both] motion-reduce:transition-none"
            >
              <StageNode milestone={here} index={hereIndex} current />
              <span className="min-w-0 truncate text-[13px] font-medium text-ink">
                {here.title}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-faint">
                {cleared}/{milestones.length}
              </span>
              <span className="sr-only">
                Stage {hereIndex + 1} of {milestones.length}. Open the stage
                list.
              </span>
            </button>
          </div>,
          document.body
        )}

      {open && (
        <StageSheet
          milestones={milestones}
          hereIndex={hereIndex}
          cleared={cleared}
          onJump={jump}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The stage's marker, carrying the same three states as the spine and the rail:
 * cleared is filled, the one you're on is ringed, everything ahead is dim. A
 * capstone is a diamond and every other stage a circle, so the difference
 * survives without colour.
 */
function StageNode({
  milestone,
  index,
  current,
}: {
  milestone: Milestone;
  index: number;
  current: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center border",
        milestone.capstone ? "rotate-45 rounded-[5px]" : "rounded-full",
        milestone.done
          ? "border-primary bg-primary text-primary-ink"
          : current
            ? "border-primary/70 bg-surface text-ink ring-2 ring-primary/20"
            : "border-line bg-surface text-faint"
      )}
    >
      {milestone.done ? (
        <Check className={cn("size-3", milestone.capstone && "-rotate-45")} />
      ) : (
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums",
            milestone.capstone && "-rotate-45"
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
    </span>
  );
}

/**
 * Every stage on one screen, as rows rather than a rail: a phone has the height
 * for the full title, the dates and the count that the rail has to compress to
 * fit six stops across 390px.
 */
function StageSheet({
  milestones,
  hereIndex,
  cleared,
  onJump,
  onClose,
}: {
  milestones: Milestone[];
  hereIndex: number;
  cleared: number;
  onJump: (id: string) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // How far the sheet has been dragged down, in px. Null while not dragging, so
  // the transition can be off mid-drag (the finger IS the animation) and on
  // again for the release.
  const [drag, setDrag] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  // Escape closes, and the sheet takes focus so the next Tab lands inside it
  // rather than back at the top of the page behind it. The page behind is
  // frozen for as long as the sheet is up — scrolling it while a modal covers
  // it moves the thing you can't see and loses your place. Same lock the mobile
  // menu and the status sheet use.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Drag to dismiss. The handle draws a sheet you can pull down, so it has to
  // actually pull — an affordance that does nothing is worse than no affordance.
  //
  // Only downward travel counts, and only from the header: the list below it
  // scrolls, and a drag that started there would fight the scroll for the same
  // finger. Past a third of the sheet's height it closes; short of that it
  // springs back, so a hesitant pull is never a dismissal.
  const CLOSE_FRACTION = 1 / 3;

  function onPointerDown(e: React.PointerEvent) {
    // Ignore secondary buttons and any press that began on a control.
    if (e.button !== 0) return;
    dragFrom.current = e.clientY;
    setDrag(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragFrom.current === null) return;
    setDrag(Math.max(0, e.clientY - dragFrom.current));
  }

  function onPointerUp() {
    const travelled = drag ?? 0;
    const height = panel.current?.getBoundingClientRect().height ?? 0;
    dragFrom.current = null;
    if (height > 0 && travelled > height * CLOSE_FRACTION) onClose();
    else setDrag(null);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jump to a stage"
      className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-bg/70 backdrop-blur-sm motion-safe:animate-[overlay-in_150ms_var(--ease-mac)_both]"
      />

      <div
        ref={panel}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className={cn(
          "relative max-h-[80dvh] overflow-y-auto rounded-t-xl border-t border-line-strong bg-raised/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md focus:outline-none",
          // The entrance plays only on a fresh open; once a drag has started,
          // the finger owns the position. On release the spring-back is a
          // transition, not the keyframes, so it starts from where you let go.
          drag === null
            ? "transition-transform duration-200 ease-mac motion-safe:animate-[sheet-up_220ms_var(--ease-mac)_both] motion-reduce:transition-none"
            : ""
        )}
      >
        {/* The grab handle and the title row are one drag surface: the list
            below them scrolls, so a drag starting there would fight it.
            touch-none stops the browser claiming the gesture for a scroll
            before the pointer handlers ever see it. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="sticky top-0 z-10 touch-none cursor-grab bg-raised/95 backdrop-blur-md active:cursor-grabbing"
        >
          <span aria-hidden className="flex justify-center pb-1 pt-2.5">
            <span className="block h-1 w-9 rounded-full bg-line-strong" />
          </span>

          <div className="flex items-center gap-3 px-4 pb-2 pt-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Stages
          </h2>
          <span className="ml-auto font-mono text-xs tabular-nums text-faint">
            {cleared}/{milestones.length} cleared
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1 text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <ol className="grid px-2 pb-2">
          {milestones.map((milestone, index) => {
            const here = index === hereIndex;
            return (
              <li key={milestone.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onJump(milestone.id)}
                  aria-current={here ? "step" : undefined}
                  className={cn(
                    // 56px min row: this is the one control on the page that
                    // exists purely for touch, so it gets a real target.
                    "flex w-full min-h-14 items-center gap-3 rounded-lg px-2 text-left transition-colors duration-150 active:bg-raised",
                    here && "bg-surface"
                  )}
                >
                  <StageNode
                    milestone={milestone}
                    index={index}
                    current={here}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {milestone.capstone && (
                        <Flag
                          className="size-3 shrink-0 text-primary-dim"
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          "min-w-0 truncate text-[13px] font-medium",
                          milestone.done ? "text-muted" : "text-ink"
                        )}
                      >
                        {milestone.title}
                      </span>
                    </span>
                    {/* The rail can only ever show the dates; here there's room
                        for what clearing the stage actually takes. */}
                    {milestone.proof && (
                      <span className="mt-0.5 block truncate text-xs text-faint">
                        {milestone.proof}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    {milestone.total > 0 && (
                      <span
                        className={cn(
                          "block font-mono text-xs tabular-nums",
                          milestone.done ? "text-primary-dim" : "text-muted"
                        )}
                      >
                        {milestone.doneCount}/{milestone.total}
                      </span>
                    )}
                    {milestone.day && (
                      <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-faint">
                        {milestone.day}
                      </span>
                    )}
                  </span>
                  <span className="sr-only">
                    {milestone.done
                      ? "cleared"
                      : here
                        ? "you are here, not cleared yet"
                        : "not cleared yet"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    document.body
  );
}
