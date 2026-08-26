"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ProgressMeter } from "@/components/portal/progress-meter";
import { MilestoneBadge, MilestoneDot } from "@/components/portal/bits";
import { Badge } from "@/components/ui/badge";
import type { MilestoneStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The build as four columns — one per system the client is getting.
 *
 * ── Why columns, and why the steps carry no number ─────────────────────────
 *
 * The rail (`Timeline` in portal/progress) answers "what is Kagu doing this
 * week". A client owning a padel venue asks a different question: "how far is
 * MY app, MY till, MY website?" — so each system gets its own bar, and the
 * overall figure on the page is the weighted sum of the four.
 *
 * The steps under a bar are deliberately just a name and a state. A column
 * with four percentages down it reads as a spreadsheet, and the eye adds them
 * up and gets the wrong answer, because the steps are weighted. The step's own
 * percentage is shown only inside its drawer, next to the words that explain
 * what the step IS — which is the only place a number like "40%" has a
 * meaning.
 *
 * ── Why the labels arrive pre-resolved ─────────────────────────────────────
 *
 * This is a client component and the dictionary is half functions, which
 * cannot cross the server boundary. The page resolves every string for every
 * step (`pctLabel`, `shareLabel`, …) and hands the finished text down — the
 * same arrangement as `PortalNavLabels` on the rail.
 *
 * ── Why the open drawer is an id, not an object ────────────────────────────
 *
 * `LiveRefresh` re-renders the page whenever a milestone row changes. Client
 * state survives that, so a drawer holding a COPY of the step would keep
 * showing 0% while the bar behind it moved to 40%. The state holds only which
 * step is open; the step itself is looked up from the fresh props on every
 * render, and a step that has been deleted closes its own drawer.
 */

export type StepView = {
  id: string;
  title: string;
  detail: string | null;
  status: MilestoneStatus;
  /** "In progress", in the reader's language. */
  statusLabel: string;
  /** 0–100, already clamped and rounded. */
  pct: number;
  /** "40%" or "40٪". */
  pctLabel: string;
  /** "45% of this system" */
  shareLabel: string | null;
  /** "Reservation — how far through this step" */
  progressAria: string;
  /** "target 12 Sep 2026" / "done 3 Sep 2026", or nothing. */
  dateLine: string | null;
  late: boolean;
};

export type SystemView = {
  id: string;
  title: string;
  detail: string | null;
  status: MilestoneStatus;
  statusLabel: string;
  pct: number;
  pctLabel: string;
  /** "47% of the build" */
  shareLabel: string | null;
  progressAria: string;
  /** "2/4 steps done" */
  stepsDoneLabel: string;
  /** "Part of Mobile app" — the drawer's context line for its steps. */
  partOfLabel: string;
  steps: StepView[];
};

export type SystemColumnsLabels = {
  systemsAria: string;
  whatThisIs: string;
  stepProgress: string;
  notStartedYet: string;
  closeStep: string;
  late: string;
};

type Opened = { systemId: string; stepId: string | null };

export function SystemColumns({
  systems,
  labels,
}: {
  systems: SystemView[];
  labels: SystemColumnsLabels;
}) {
  const [opened, setOpened] = useState<Opened | null>(null);
  // The element that opened the drawer, so focus can go back to it. Read from
  // the click itself rather than document.activeElement: Safari and Firefox on
  // macOS do not focus a button on click, so activeElement would be <body>.
  const openerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((next: Opened, opener: HTMLElement) => {
    openerRef.current = opener;
    setOpened(next);
  }, []);
  const close = useCallback(() => {
    setOpened(null);
    openerRef.current?.focus?.();
    openerRef.current = null;
  }, []);

  // Resolve from the live props, every render.
  const system = opened ? systems.find((s) => s.id === opened.systemId) : undefined;
  const step =
    opened && system && opened.stepId
      ? system.steps.find((s) => s.id === opened.stepId)
      : undefined;
  // A refresh that removed the row simply stops the drawer rendering — no
  // effect needed, and the stale id is overwritten by the next open. The
  // drawer's own unmount restores scrolling and focus.
  const resolved =
    opened !== null &&
    system !== undefined &&
    (opened.stepId === null || step !== undefined);

  return (
    <>
      <ul
        aria-label={labels.systemsAria}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {systems.map((s) => (
          <li key={s.id} className="min-w-0">
            <SystemColumn
              system={s}
              labels={labels}
              onOpenSystem={(el) => open({ systemId: s.id, stepId: null }, el)}
              onOpenStep={(st, el) => open({ systemId: s.id, stepId: st.id }, el)}
            />
          </li>
        ))}
      </ul>

      {resolved && system && (
        <StepDrawer
          key={step ? step.id : system.id}
          system={system}
          step={step ?? null}
          labels={labels}
          onClose={close}
        />
      )}
    </>
  );
}

/* ── One column ───────────────────────────────────────────────────────────── */

function SystemColumn({
  system,
  labels,
  onOpenSystem,
  onOpenStep,
}: {
  system: SystemView;
  labels: SystemColumnsLabels;
  onOpenSystem: (opener: HTMLElement) => void;
  onOpenStep: (step: StepView, opener: HTMLElement) => void;
}) {
  const complete = system.pct >= 100;
  return (
    <section className="flex h-full min-w-0 flex-col rounded-lg border border-line bg-surface">
      {/* The bar. The name is the button that opens the system's own drawer;
          the meter sits beside it rather than inside it, so the progressbar
          keeps its role (a button flattens its children for assistive tech). */}
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 truncate text-[calc(13px*var(--text-scale,1))] font-medium text-ink">
            <button
              type="button"
              onClick={(e) => onOpenSystem(e.currentTarget)}
              className="rounded-sm underline-offset-2 transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {system.title}
            </button>
          </h3>
          <span
            className={cn(
              "shrink-0 font-mono text-[calc(18px*var(--text-scale,1))] font-medium tabular-nums",
              complete ? "text-primary" : "text-ink"
            )}
          >
            {system.pctLabel}
          </span>
        </div>
        <ProgressMeter
          className="mt-2"
          pct={system.pct}
          done={0}
          total={0}
          caption={system.stepsDoneLabel}
          label={system.progressAria}
        />
        {system.shareLabel && (
          <p className="mt-1.5 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
            {system.shareLabel}
          </p>
        )}
      </div>

      {/* The steps. A short rail hangs off the bar — the sketch's "!" — so the
          nesting is visible without a second progress bar per row. Each row is
          its own button: name, state (the dot's shape, plus a word for
          screen readers), and a pill only when something is wrong. */}
      <ol className="mx-4 mb-4 grid gap-1 border-s border-line ps-2">
        {system.steps.map((step) => {
          const flagged = step.status === "blocked" || step.late;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={(e) => onOpenStep(step, e.currentTarget)}
                className={cn(
                  "flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start transition-colors duration-150 hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:scale-[0.98]",
                  step.status === "done" ? "text-muted" : "text-ink"
                )}
              >
                <MilestoneDot status={step.status} />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[calc(13px*var(--text-scale,1))]",
                    step.status === "done" && "line-through decoration-line"
                  )}
                >
                  {step.title}
                </span>
                {!flagged && <span className="sr-only">{step.statusLabel}</span>}
                {step.status === "blocked" && (
                  <MilestoneBadge status={step.status} label={step.statusLabel} />
                )}
                {step.late && step.status !== "blocked" && (
                  <Badge tone="amber">{labels.late}</Badge>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ── The drawer ───────────────────────────────────────────────────────────── */

/** Keep in sync with the exit animation durations below. */
const CLOSE_MS = 180;

/**
 * One step, explained.
 *
 * A side sheet rather than an inline expander: the explanation is a paragraph
 * or two, and opening it in place would push the other three columns around.
 * Frosted, because it is a transient surface (DESIGN.md → Motion); the columns
 * behind it stay legible so the reader keeps their place. It slides in from
 * the edge it is anchored to and leaves the same way — `sheet-in`/`sheet-out`,
 * with a mirrored pair for RTL, where the inline end is the left edge.
 *
 * Focus moves to the close button on open and is handed back to the step that
 * opened it on close; Escape closes; Tab is kept inside; the page under it
 * does not scroll — the same discipline as the mobile nav sheet in
 * `portal-sidebar.tsx`, for the same reasons.
 */
function StepDrawer({
  system,
  step,
  labels,
  onClose,
}: {
  system: SystemView;
  step: StepView | null;
  labels: SystemColumnsLabels;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  // Play the exit, then unmount. Guarded so a second Escape during the exit
  // does not schedule a second onClose.
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab") {
        // Keep focus inside the sheet: the close button and the scrollable
        // body. Walk the real list rather than assuming one element.
        const root = sheetRef.current;
        if (!root) return;
        const focusable = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button, [href], [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const subject = step ?? system;

  return (
    <div
      // Close on pointer-DOWN on the backdrop itself, not on click: a click
      // fires on the common ancestor of mousedown and mouseup, so selecting
      // text in the sheet and releasing outside it would otherwise close it.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className={cn(
        "fixed inset-0 z-50 bg-bg/60",
        closing
          ? "motion-safe:animate-[overlay-out_180ms_var(--ease-mac)_both]"
          : "motion-safe:animate-[overlay-in_150ms_var(--ease-mac)_both]"
      )}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-step-title"
        className={cn(
          "absolute inset-y-0 inset-e-0 flex w-full max-w-md flex-col border-s border-line-strong bg-raised/90 shadow-2xl backdrop-blur-md",
          closing
            ? "motion-safe:animate-[sheet-out_180ms_var(--ease-mac)_both] motion-safe:rtl:animate-[sheet-out-rtl_180ms_var(--ease-mac)_both]"
            : "motion-safe:animate-[sheet-in_220ms_var(--ease-mac)_both] motion-safe:rtl:animate-[sheet-in-rtl_220ms_var(--ease-mac)_both]"
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2
              id="portal-step-title"
              className="text-[calc(16px*var(--text-scale,1))] font-medium text-ink"
            >
              {subject.title}
            </h2>
            {step && (
              <p className="mt-0.5 text-[calc(12px*var(--text-scale,1))] text-muted">
                {system.partOfLabel}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={labels.closeStep}
            className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-muted transition-colors duration-150 hover:bg-raised hover:text-ink active:scale-[0.98]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" tabIndex={0}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <MilestoneBadge status={subject.status} label={subject.statusLabel} />
            {step?.late && step.status !== "done" && (
              <Badge tone="amber">{labels.late}</Badge>
            )}
            {subject.shareLabel && (
              <span className="font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint">
                {subject.shareLabel}
              </span>
            )}
            {step?.dateLine && (
              <span
                className={cn(
                  "font-mono text-[calc(11px*var(--text-scale,1))]",
                  step.status === "done"
                    ? "text-primary-dim"
                    : step.late
                      ? "text-amber"
                      : "text-faint"
                )}
              >
                {step.dateLine}
              </span>
            )}
          </div>

          {/* The one place the step's own number appears. The bar under it is
              decoration for the same value, so it is hidden from assistive
              tech rather than read out a second time. */}
          <p className="mt-5 text-[calc(12px*var(--text-scale,1))] text-muted">
            {labels.stepProgress}
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span
              className={cn(
                "font-mono text-[calc(22px*var(--text-scale,1))] font-medium tabular-nums",
                subject.pct >= 100 ? "text-primary" : "text-ink"
              )}
            >
              {subject.pctLabel}
            </span>
            {subject.pct === 0 && subject.status === "planned" && (
              <span className="text-[calc(12px*var(--text-scale,1))] text-faint">
                {labels.notStartedYet}
              </span>
            )}
          </div>
          <div aria-hidden>
            <ProgressMeter
              className="mt-2"
              pct={subject.pct}
              done={0}
              total={0}
              caption=""
              label={subject.progressAria}
            />
          </div>

          {subject.detail && (
            <>
              <p className="mt-6 text-[calc(12px*var(--text-scale,1))] text-muted">
                {labels.whatThisIs}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] leading-relaxed text-ink">
                {subject.detail}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
