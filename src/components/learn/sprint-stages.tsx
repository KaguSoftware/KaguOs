"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Flag, Lock } from "lucide-react";
import { ResourceRow } from "@/components/learn/resource-row";
import { ProofBlock } from "@/components/learn/proof-block";
import { MoreMark, ShowMore, useDisclosures } from "@/components/learn/show-more";
import {
  stageDays,
  stageHours,
  stageViewId,
  type StageView,
  type Technique,
} from "@/lib/learn";
import { cn } from "@/lib/utils";
import type {
  SprintGoal,
  SprintPractice,
  SprintProofCriterion,
  SprintProofSubmission,
  SprintResource,
} from "@/lib/types";

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
  sprintId,
  meId,
  views,
  build,
  resourcesByStage,
  criteriaByStage,
  myProof,
  techniques,
  isDone,
  onToggle,
  onProofSent,
  onProofWithdrawn,
  isWatched,
  onToggleWatched,
  readOnly,
}: {
  sprintId: string;
  meId: string;
  views: StageView[];
  /** The capstone's build timeline, shown inside the stage it belongs to. */
  build: SprintPractice[];
  /** Stage id (or "unstaged") → its resources. */
  resourcesByStage: Map<string, SprintResource[]>;
  /** Stage id → the conditions its hand-in is read against. */
  criteriaByStage: Map<string, SprintProofCriterion[]>;
  /** Stage id → my hand-in. Other people's never reach the client. */
  myProof: Map<string, SprintProofSubmission>;
  /** Goal id → the numbered run of resources that teaches it. */
  techniques: Map<string, Technique[]>;
  isDone: (goalId: string) => boolean;
  onToggle: (goalId: string, next: boolean) => void;
  /** Handing in clears the stage, so the proof goal's tick moves with it. */
  onProofSent: (goalId: string | null) => void;
  onProofWithdrawn: (goalId: string | null) => void;
  isWatched: (resourceId: string) => boolean;
  onToggleWatched: (resourceId: string, next: boolean) => void;
  /** Not a participant: you see the shape, you can't tick it. */
  readOnly: boolean;
}) {
  // Cleared and ahead stages start closed; the one you're on starts open.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(views.filter((v) => v.current).map(stageViewId))
  );
  // Every bit of depth on this page — stage briefs, what a goal means, the
  // proof brief and its conditions — opens from here. Held above the cards so
  // an expanded brief survives the stage being closed around it.
  const more = useDisclosures();
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

  // The build timeline is the capstone's own plan, so it lives in the capstone's
  // card rather than in a block of its own. Falling back to the final stage
  // keeps it on the page for a program that never named one.
  const buildOwner =
    build.length > 0
      ? (views.find((v) => v.stage?.kind === "capstone") ?? views[last])
      : undefined;
  const buildOwnerId = buildOwner ? stageViewId(buildOwner) : null;

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
            // The extra offset from md up clears the sticky milestone bar, so a
            // jump from it doesn't land the stage underneath it.
            className="grid min-w-0 scroll-mt-20 grid-cols-[1.75rem_1fr] gap-x-3 sm:grid-cols-[2rem_1fr] sm:gap-x-4 md:scroll-mt-32"
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
                    {/* Where to learn it leads the stage: you watch before you
                        tick, so the material comes before the checklist rather
                        than after everything else on the page. */}
                    {resources.length > 0 && (
                      <div className="mb-3 border-b border-line pb-3">
                        <p className="mb-1.5 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
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

                    {view.stage?.summary && (
                      <p className="mb-3 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
                        {view.stage.summary}
                      </p>
                    )}

                    {/* The long form, folded away. Split on blank lines:
                        paragraphs are the only structure a stage brief needs,
                        and anything richer would be a markdown renderer for
                        four sentences. */}
                    {view.stage?.detail && (
                      <ShowMore
                        open={more.isOpen(`stage:${id}`)}
                        onToggle={() => more.toggle(`stage:${id}`)}
                        label="More on this stage"
                        className="mb-3"
                        bodyClassName="grid gap-2 border-l border-line pl-3"
                      >
                        {view.stage.detail.split("\n\n").map((para, i) => (
                          <p
                            key={i}
                            className="max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted"
                          >
                            {para}
                          </p>
                        ))}
                      </ShowMore>
                    )}

                    {view.total === 0 ? (
                      <p className="text-[calc(13px*var(--text-scale,1))] text-faint">No goals in this stage yet.</p>
                    ) : (
                      <ul className="grid gap-0.5">
                        {view.goals.map((goal) => (
                          <GoalRow
                            key={goal.id}
                            goal={goal}
                            done={isDone(goal.id)}
                            readOnly={readOnly}
                            onToggle={onToggle}
                            teaches={techniques.get(goal.id)}
                            isWatched={isWatched}
                            onToggleWatched={onToggleWatched}
                            detailOpen={more.isOpen(`goal:${goal.id}`)}
                            onToggleDetail={() => more.toggle(`goal:${goal.id}`)}
                          />
                        ))}
                      </ul>
                    )}

                    {(view.proof || view.stage?.proof) && (
                      <ProofBlock
                        sprintId={sprintId}
                        meId={meId}
                        stage={view.stage}
                        goal={view.proof}
                        criteria={criteriaByStage.get(id) ?? []}
                        submission={myProof.get(id) ?? null}
                        done={view.proof ? isDone(view.proof.id) : view.cleared}
                        readOnly={readOnly}
                        more={more}
                        onSubmitted={() => onProofSent(view.proof?.id ?? null)}
                        onWithdrawn={() => onProofWithdrawn(view.proof?.id ?? null)}
                      />
                    )}

                    {id === buildOwnerId && (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="mb-1.5 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                          Build timeline
                        </p>
                        <ul className="grid gap-1.5">
                          {build.map((step) => (
                            <li key={step.id} className="flex min-w-0 items-baseline gap-3">
                              <span className="w-8 shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-primary-dim">
                                {step.label}
                              </span>
                              <span className="min-w-0 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
                                {step.body ?? step.title}
                              </span>
                            </li>
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
            "font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums",
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

/**
 * One goal — its line, the sentence under it that says what the line means, and
 * (when it has them) the numbered techniques that teach it.
 *
 * The two ticks on this row mean different things and stay separate. The goal's
 * tick says you did the thing; a technique's tick says you watched it. Nesting
 * them under one heading is the whole point: watching four videos about framing
 * is what you do to clear "Framing", and it should not need a second panel to
 * say so. The count on the right is watched-of-total, which is why it can read
 * 4/4 on a goal you haven't ticked.
 *
 * They stay separate, but they're ordered: a goal that has a run is locked
 * until the run is finished (see `locked`). Watching everything still doesn't
 * tick the goal for you — you say when you did the work — but you can't say it
 * before you've seen what the work is.
 *
 * The stage's proof is NOT one of these rows — it's handed in, not ticked, and
 * lives in its own block (see ProofBlock).
 */
function GoalRow({
  goal,
  done,
  readOnly,
  onToggle,
  teaches,
  isWatched,
  onToggleWatched,
  detailOpen,
  onToggleDetail,
}: {
  goal: SprintGoal;
  done: boolean;
  readOnly: boolean;
  onToggle: (goalId: string, next: boolean) => void;
  /** The run of resources that teaches this goal, if any. */
  teaches?: Technique[];
  isWatched: (resourceId: string) => boolean;
  onToggleWatched: (resourceId: string, next: boolean) => void;
  /** Whether the sentence under the title is showing. */
  detailOpen: boolean;
  onToggleDetail: () => void;
}) {
  const watched = teaches?.filter((t) => isWatched(t.resource.id)).length ?? 0;
  const seenAll = teaches !== undefined && watched === teaches.length;

  // A goal with a run under it isn't tickable until every technique in that run
  // is watched. The run IS the goal — "Framing" is those four videos — so a
  // tick with two of them unwatched claims work that hasn't happened.
  //
  // Unticking is never blocked. A goal ticked before its run grew would
  // otherwise be stuck done forever, and the tick is yours to take back.
  const locked = teaches !== undefined && !seenAll && !done;

  const mark = (
    <span
      aria-hidden
      className={cn(
        "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
        done
          ? "bg-primary text-primary-ink"
          : locked
            ? "border border-dashed border-line-strong bg-surface text-faint"
            : "border border-line-strong bg-surface"
      )}
    >
      {done ? (
        <Check className="size-2.5" />
      ) : (
        locked && <Lock className="size-2.5" />
      )}
    </span>
  );

  // The title only. What the goal MEANS opens from the chevron beside it —
  // twenty goals each carrying a second line is the wall of text this page
  // exists to avoid.
  const label = (
    <span
      className={cn(
        "min-w-0 flex-1 text-[calc(13px*var(--text-scale,1))] leading-relaxed transition-colors duration-150",
        done
          ? "text-faint line-through decoration-line-strong"
          : locked
            ? "text-muted"
            : "text-ink"
      )}
    >
      {goal.title}
    </span>
  );

  const tally = teaches && (
    <span
      className={cn(
        "mt-px shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums transition-colors duration-150",
        seenAll ? "text-primary-dim" : "text-faint"
      )}
    >
      {watched}/{teaches.length}
    </span>
  );

  // The run sits outside the goal's button — it's full of links, and a link
  // inside a button is neither. The rule down its left is what says "these
  // belong to the line above" without a second heading to read.
  //
  // It opens from the same chevron as the goal's meaning, and starts closed:
  // eighteen video rows under four goals is most of what made this page a wall,
  // and the watched-of-total count on the row already says they're there.
  const run = teaches && (
    <ul className="mb-1.5 ml-2.75 grid border-l border-line pl-2.5">
      {teaches.map(({ resource, index }) => (
        <ResourceRow
          key={resource.id}
          resource={resource}
          index={index}
          watched={isWatched(resource.id)}
          readOnly={readOnly}
          onToggle={onToggleWatched}
        />
      ))}
    </ul>
  );

  const hasMore = Boolean(goal.detail) || Boolean(teaches?.length);

  return (
    <li className="min-w-0">
      {/* The chevron is a sibling of the tick, never a child: one button inside
          another is neither, and ticking a goal by reaching for its
          explanation would be the worse of the two mistakes. */}
      <div className="flex items-start gap-1">
        {readOnly ? (
          <div className="flex min-w-0 flex-1 items-start gap-2.5 px-0.5 py-3 sm:py-1.5">
            {mark}
            {label}
            {tally}
          </div>
        ) : locked ? (
          // Not a disabled button: a dead row tells you nothing about why it's
          // dead. Clicking opens the run instead, so the answer — these four,
          // one of them watched — is the thing your click produces. It only
          // ever opens; closing the explanation you just asked for would be
          // the click landing on nothing all over again.
          <button
            type="button"
            aria-disabled
            aria-label={`${goal.title}: watch all ${teaches?.length} techniques to tick this — ${watched} watched so far`}
            onClick={() => {
              if (!detailOpen) onToggleDetail();
            }}
            // Taller on a phone: this is the sprint's primary action, tapped
            // dozens of times over two weeks, and 33px is a thumb's-width guess.
            // Back to the dense row from sm up, where it's a mouse target.
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-md px-0.5 py-3 text-left transition-colors duration-150 hover:bg-raised/50 sm:py-1.5"
          >
            {mark}
            {label}
            {tally}
          </button>
        ) : (
          <button
            type="button"
            aria-pressed={done}
            aria-label={`${goal.title}: ${done ? "done — click to untick" : "mark done"}`}
            onClick={() => onToggle(goal.id, !done)}
            // Taller on a phone: this is the sprint's primary action, tapped
            // dozens of times over two weeks, and 33px is a thumb's-width guess.
            // Back to the dense row from sm up, where it's a mouse target.
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-md px-0.5 py-3 text-left transition-colors duration-150 hover:bg-raised/50 sm:py-1.5"
          >
            {mark}
            {label}
            {tally}
          </button>
        )}
        {hasMore && (
          <span className="py-1">
            <MoreMark
              open={detailOpen}
              onToggle={onToggleDetail}
              label={
                teaches?.length
                  ? `What "${goal.title}" means, and what teaches it`
                  : `What "${goal.title}" means`
              }
            />
          </span>
        )}
      </div>

      {detailOpen && (
        <>
          {goal.detail && (
            <p className="mb-1.5 ml-2.75 max-w-[70ch] border-l border-line pl-2.5 text-xs leading-relaxed text-muted">
              {goal.detail}
            </p>
          )}
          {run}
          {locked && (
            <p className="mb-1.5 ml-2.75 border-l border-line pl-2.5 font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
              {(teaches?.length ?? 0) - watched} left to watch before this goal ticks
            </p>
          )}
        </>
      )}
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
