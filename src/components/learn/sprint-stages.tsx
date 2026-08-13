"use client";

import { useState } from "react";
import { Check, ChevronDown, FileText, Flag, Link2 } from "lucide-react";
import { SignedFileLink } from "@/components/ui/signed-file-link";
import { stageMeta, stageViewId, type StageView } from "@/lib/learn";
import { cn } from "@/lib/utils";
import type { SprintGoal, SprintResource } from "@/lib/types";

/**
 * The sprint as a run of stages. Three states carry the whole level feeling:
 *
 *   cleared — collapsed to one line, dimmed, openable
 *   active  — expanded, stronger border, the only one open by default
 *   ahead   — collapsed and quiet
 *
 * Gating is soft on purpose: an ahead-stage opens and ticks like any other. The
 * visual progression does the work; a lock that refuses a tick would just be
 * friction. Working ahead is allowed, and the rail shows it honestly.
 */
export function SprintStages({
  views,
  resourcesByStage,
  isDone,
  onToggle,
  readOnly,
}: {
  views: StageView[];
  /** Stage id (or "unstaged") → its resources. */
  resourcesByStage: Map<string, SprintResource[]>;
  isDone: (goalId: string) => boolean;
  onToggle: (goalId: string, next: boolean) => void;
  /** Not a participant: you see the shape, you can't tick it. */
  readOnly: boolean;
}) {
  // Cleared and ahead stages start closed; the one you're on starts open.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(views.filter((v) => v.current).map(stageViewId))
  );

  function toggleOpen(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ol className="grid gap-3">
      {views.map((view, index) => {
        const id = stageViewId(view);
        const isOpen = open.has(id);
        const meta = stageMeta(view.stage);
        const capstone = view.stage?.kind === "capstone";
        const title = view.stage?.title ?? "Goals";
        const resources = resourcesByStage.get(id) ?? [];

        return (
          <li
            key={id}
            id={`stage-${id}`}
            className={cn(
              "scroll-mt-20 rounded-lg border bg-surface transition-colors duration-200 ease-mac motion-reduce:transition-none",
              view.current
                ? "border-line-strong"
                : "border-line"
            )}
          >
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`stage-body-${id}`}
                onClick={() => toggleOpen(id)}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-150 hover:bg-raised/50"
              >
                <span
                  aria-hidden
                  className={cn(
                    "shrink-0 font-mono text-xs tabular-nums",
                    view.cleared
                      ? "text-primary-dim"
                      : view.current
                        ? "text-ink"
                        : "text-faint"
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium transition-colors duration-150",
                      view.cleared ? "text-muted" : view.current ? "text-ink" : "text-muted"
                    )}
                  >
                    {capstone && (
                      <Flag className="size-3.5 shrink-0 text-primary-dim" aria-hidden />
                    )}
                    <span className="truncate">{title}</span>
                  </span>
                  {meta && (
                    <span className="mt-0.5 block truncate font-mono text-xs text-faint">
                      {meta}
                    </span>
                  )}
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
                {view.cleared && (
                  <Check className="size-3.5 shrink-0 text-primary-dim" aria-hidden />
                )}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0 text-faint transition-transform duration-200 ease-mac motion-reduce:transition-none",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
            </h3>

            {isOpen && (
              <div id={`stage-body-${id}`} className="border-t border-line px-4 pb-3 pt-3">
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
                      Resources
                    </p>
                    <ul className="grid gap-1">
                      {resources.map((resource) => (
                        <StageResource key={resource.id} resource={resource} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function GoalRow({
  goal,
  done,
  readOnly,
  onToggle,
  hint,
}: {
  goal: SprintGoal;
  done: boolean;
  readOnly: boolean;
  onToggle: (goalId: string, next: boolean) => void;
  hint?: string;
}) {
  const mark = (
    <span
      aria-hidden
      className={cn(
        "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
        done
          ? "bg-primary text-primary-ink"
          : "border border-line-strong bg-surface"
      )}
    >
      {done && <Check className="size-2.5" />}
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
        className="flex w-full items-start gap-2.5 rounded-md px-0.5 py-1.5 text-left transition-colors duration-150 hover:bg-raised/50"
      >
        {mark}
        {label}
      </button>
    </li>
  );
}

function StageResource({ resource }: { resource: SprintResource }) {
  const Icon = resource.url ? Link2 : FileText;
  return (
    <li className="flex items-center gap-2 text-[13px]">
      <Icon className="size-3.5 shrink-0 text-faint" aria-hidden />
      {resource.url ? (
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 truncate text-muted underline-offset-2 hover:text-primary-dim hover:underline"
        >
          {resource.title}
        </a>
      ) : resource.file_path ? (
        <SignedFileLink
          bucket="learn"
          path={resource.file_path}
          title={resource.title}
          className="min-w-0 truncate text-left text-muted underline-offset-2 hover:text-primary-dim hover:underline"
        >
          <span className="min-w-0 truncate">{resource.title}</span>
        </SignedFileLink>
      ) : (
        <span className="min-w-0 truncate text-faint">{resource.title}</span>
      )}
    </li>
  );
}
