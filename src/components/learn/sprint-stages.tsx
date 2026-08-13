"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Flag, Lock } from "lucide-react";
import { ResourceRow } from "@/components/learn/resource-row";
import { stageDays, stageHours, stageViewId, type StageView } from "@/lib/learn";
import { cn } from "@/lib/utils";
import type { SprintGoal, SprintResource } from "@/lib/types";

/**
 * The sprint as a track you walk down. One node per stage on a spine that fills
 * behind you, so "how far in am I" is answered by the shape of the page before
 * a single number is read.
 *
 * Three states carry it:
 *
 *   cleared — node filled, spine lit past it, card collapsed and quiet
 *   current — node ringed, card open, the only one open by default
 *   ahead   — node hollow with a lock mark, card collapsed and dim
 *
 * The lock is honest theatre. Gating is soft by design (see migration 0056): an
 * ahead-stage opens and ticks like any other, and the lock is a picture of where
 * you are, not a rule that refuses you. A gate that actually blocked would be
 * the ten-click flow the product principles ban.
 */
export function SprintStages({
  views,
  resourcesByStage,
  isDone,
  onToggle,
  isWatched,
  onToggleWatched,
  readOnly,
}: {
  views: StageView[];
  /** Stage id (or "unstaged") → its resources. */
  resourcesByStage: Map<string, SprintResource[]>;
  isDone: (goalId: string) => boolean;
  onToggle: (goalId: string, next: boolean) => void;
  isWatched: (resourceId: string) => boolean;
  onToggleWatched: (resourceId: string, next: boolean) => void;
  /** Not a participant: you see the shape, you can't tick it. */
  readOnly: boolean;
}) {
  // Cleared and ahead stages start closed; the one you're on starts open.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(views.filter((v) => v.current).map(stageViewId))
  );
  const justCleared = useJustCleared(views);

  function toggleOpen(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const last = views.length - 1;

  return (
    <ol className="grid">
      {views.map((view, index) => {
        const id = stageViewId(view);
        const isOpen = open.has(id);
        const capstone = view.stage?.kind === "capstone";
        const title = view.stage?.title ?? "Goals";
        const resources = resourcesByStage.get(id) ?? [];
        const ahead = !view.cleared && !view.current;
        const celebrate = justCleared === id;
        // The spine above a node is lit when the stage before it is cleared,
        // so the line reads as ground you've already covered.
        const litAbove = index > 0 && views[index - 1].cleared;

        return (
          <li
            key={id}
            id={`stage-${id}`}
            className="grid scroll-mt-20 grid-cols-[1.75rem_1fr] gap-x-3 sm:grid-cols-[2rem_1fr] sm:gap-x-4"
          >
            {/* ---- The spine. Decoration would be banned; this is the progress
                indicator itself, which is why it's drawn and not a border. */}
            <div aria-hidden className="flex flex-col items-center">
              <span
                className={cn(
                  "h-2 w-px shrink-0 transition-colors duration-300 ease-mac motion-reduce:transition-none",
                  index === 0 ? "bg-transparent" : litAbove ? "bg-primary/50" : "bg-line"
                )}
              />
              <StageNode
                index={index}
                cleared={view.cleared}
                current={view.current}
                capstone={capstone}
                celebrate={celebrate}
              />
              <span
                className={cn(
                  "w-px flex-1 transition-colors duration-300 ease-mac motion-reduce:transition-none",
                  index === last
                    ? "bg-transparent"
                    : view.cleared
                      ? "bg-primary/50"
                      : "bg-line"
                )}
              />
            </div>

            <div className="min-w-0 pb-2.5">
              <div
                className={cn(
                  "rounded-lg border transition-colors duration-200 ease-mac motion-reduce:transition-none",
                  view.current
                    ? "border-line-strong bg-surface"
                    : view.cleared
                      ? "border-line bg-surface"
                      : "border-line bg-surface/40",
                  celebrate && "animate-stage-clear"
                )}
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`stage-body-${id}`}
                    onClick={() => toggleOpen(id)}
                    className="w-full cursor-pointer rounded-lg px-3.5 py-3 text-left transition-colors duration-150 hover:bg-raised/50 sm:px-4"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 text-sm font-medium transition-colors duration-150",
                          view.current
                            ? "text-ink"
                            : view.cleared
                              ? "text-muted"
                              : "text-muted"
                        )}
                      >
                        {capstone && (
                          <Flag
                            className={cn(
                              "size-3.5 shrink-0",
                              view.cleared || view.current
                                ? "text-primary-dim"
                                : "text-faint"
                            )}
                            aria-hidden
                          />
                        )}
                        <span className="truncate">{title}</span>
                      </span>

                      {view.total > 0 && (
                        <span
                          className={cn(
                            "shrink-0 font-mono text-xs tabular-nums",
                            view.cleared ? "text-primary-dim" : "text-muted"
                          )}
                        >
                          {view.doneCount}/{view.total}
                        </span>
                      )}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "size-3.5 shrink-0 text-faint transition-transform duration-200 ease-mac motion-reduce:transition-none",
                          isOpen && "rotate-180"
                        )}
                      />
                    </span>

                    <span className="mt-1.5 flex items-center gap-3">
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-xs text-faint">
                        {ahead && <Lock className="size-3 shrink-0" aria-hidden />}
                        <span className="truncate">
                          {[stageDays(view.stage), stageHours(view.stage)]
                            .filter(Boolean)
                            .join(" · ") ||
                            (ahead ? "not yet reached" : " ")}
                        </span>
                      </span>
                      {view.total > 0 && (
                        <Pips
                          total={view.total}
                          done={view.doneCount}
                          dim={ahead}
                        />
                      )}
                    </span>
                    {ahead && (
                      <span className="sr-only">
                        You haven&apos;t reached this stage yet. You can still open it.
                      </span>
                    )}
                  </button>
                </h3>

                {isOpen && (
                  <div
                    id={`stage-body-${id}`}
                    className="border-t border-line px-3.5 pb-3.5 pt-3 sm:px-4"
                  >
                    {view.stage?.summary && (
                      <p className="mb-3 max-w-[70ch] text-[13px] leading-relaxed text-muted">
                        {view.stage.summary}
                      </p>
                    )}

                    {view.total === 0 ? (
                      <p className="text-[13px] text-faint">No goals in this stage yet.</p>
                    ) : (
                      <ul className="grid gap-0.5">
                        {view.goals.map((goal) => (
                          <GoalRow
                            key={goal.id}
                            goal={goal}
                            done={isDone(goal.id)}
                            readOnly={readOnly}
                            onToggle={onToggle}
                          />
                        ))}
                      </ul>
                    )}

                    {(view.proof || view.stage?.proof) && (
                      <div className="mt-3 border-t border-dashed border-line pt-3">
                        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">
                          Proof
                        </p>
                        {view.proof ? (
                          <ul>
                            <GoalRow
                              goal={view.proof}
                              done={isDone(view.proof.id)}
                              readOnly={readOnly}
                              onToggle={onToggle}
                              hint={view.stage?.proof ?? undefined}
                              proof
                            />
                          </ul>
                        ) : (
                          <p className="max-w-[70ch] text-[13px] leading-relaxed text-muted">
                            {view.stage?.proof}
                          </p>
                        )}
                      </div>
                    )}

                    {resources.length > 0 && (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">
                          Where to learn it
                        </p>
                        <ul className="grid gap-0.5">
                          {resources.map((resource) => (
                            <ResourceRow
                              key={resource.id}
                              resource={resource}
                              watched={isWatched(resource.id)}
                              readOnly={readOnly}
                              onToggle={onToggleWatched}
                            />
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The stage's marker on the spine. A capstone is a diamond, everything else a
 * circle — shape carries the difference so it survives without colour.
 */
function StageNode({
  index,
  cleared,
  current,
  capstone,
  celebrate,
}: {
  index: number;
  cleared: boolean;
  current: boolean;
  capstone: boolean;
  celebrate: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center border transition-colors duration-200 ease-mac motion-reduce:transition-none",
        capstone ? "rotate-45 rounded-[6px]" : "rounded-full",
        cleared
          ? "border-primary bg-primary text-primary-ink"
          : current
            ? "border-primary/70 bg-surface text-ink ring-2 ring-primary/20"
            : "border-line bg-surface text-faint",
        celebrate && "animate-node-pop"
      )}
    >
      {cleared ? (
        <Check className={cn("size-3.5", capstone && "-rotate-45")} />
      ) : (
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums",
            capstone && "-rotate-45"
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
    </span>
  );
}

/**
 * One segment per goal, filling left to right. A bar would say 60%; this says
 * three of five, which is the number you're actually working against.
 */
function Pips({ total, done, dim }: { total: number; done: number; dim: boolean }) {
  // Past a dozen goals the segments get thinner than the gaps between them and
  // stop reading as a count. A bar is the honest fallback at that size.
  const segments = total <= 12 ? total : 1;
  const filled = segments === 1 ? 0 : done;

  return (
    <span aria-hidden className="flex w-16 shrink-0 gap-[3px] sm:w-20">
      {segments === 1 ? (
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-raised">
          <span
            className={cn(
              "block h-full rounded-full transition-[width] duration-300 ease-mac motion-reduce:transition-none",
              dim ? "bg-line-strong" : "bg-primary"
            )}
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </span>
      ) : (
        Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200 ease-mac motion-reduce:transition-none",
              i < filled ? (dim ? "bg-line-strong" : "bg-primary") : "bg-raised"
            )}
          />
        ))
      )}
    </span>
  );
}

function GoalRow({
  goal,
  done,
  readOnly,
  onToggle,
  hint,
  proof,
}: {
  goal: SprintGoal;
  done: boolean;
  readOnly: boolean;
  onToggle: (goalId: string, next: boolean) => void;
  hint?: string;
  /** The stage's gate: marked as a diamond, echoing the capstone node. */
  proof?: boolean;
}) {
  const mark = (
    <span
      aria-hidden
      className={cn(
        "mt-px flex size-[18px] shrink-0 items-center justify-center transition-colors duration-150 motion-reduce:transition-none",
        proof ? "rotate-45 rounded-[4px]" : "rounded-full",
        done ? "bg-primary text-primary-ink" : "border border-line-strong bg-surface"
      )}
    >
      {done && <Check className={cn("size-2.5", proof && "-rotate-45")} />}
    </span>
  );

  const label = (
    <span className="min-w-0 flex-1">
      <span
        className={cn(
          "block text-[13px] leading-relaxed transition-colors duration-150",
          done ? "text-faint line-through decoration-line-strong" : "text-ink"
        )}
      >
        {goal.title}
      </span>
      {hint && (
        <span className="mt-0.5 block max-w-[70ch] text-xs leading-relaxed text-muted">
          {hint}
        </span>
      )}
    </span>
  );

  if (readOnly) {
    return (
      <li className="flex items-start gap-2.5 px-0.5 py-1.5">
        {mark}
        {label}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        aria-pressed={done}
        aria-label={`${goal.title}: ${done ? "done — click to untick" : "mark done"}`}
        onClick={() => onToggle(goal.id, !done)}
        className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-0.5 py-1.5 text-left transition-colors duration-150 hover:bg-raised/50"
      >
        {mark}
        {label}
      </button>
    </li>
  );
}

/**
 * The id of the stage that cleared on THIS render, or null.
 *
 * Derived from a ref of the previous cleared-set rather than stored, so it
 * fires on the tick that completed a stage and never on mount, on a re-render,
 * or on a page you arrive at already finished. Nothing to celebrate about work
 * you did last Tuesday.
 */
function useJustCleared(views: StageView[]): string | null {
  const seen = useRef<Set<string> | null>(null);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const cleared = new Set(views.filter((v) => v.cleared).map(stageViewId));
    const before = seen.current;
    seen.current = cleared;
    // First pass records the baseline: whatever was already cleared on arrival
    // is history, not news.
    if (before === null) return;

    const fresh = [...cleared].find((stageId) => !before.has(stageId));
    if (!fresh) return;
    setId(fresh);
    const timer = setTimeout(() => setId(null), 700);
    return () => clearTimeout(timer);
  }, [views]);

  return id;
}
