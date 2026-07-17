"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toggleGoalProgress } from "@/lib/actions/learn";
import { useAction } from "@/lib/use-action";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RaceStandings, type RacePerson } from "@/components/learn/race-standings";
import { cn } from "@/lib/utils";
import type { SprintGoal } from "@/lib/types";

/**
 * One owner for the sprint's tick state: your checklist and the standings race
 * read the same optimistic done-set, so a tick moves your lane the moment you
 * click — no waiting on the server round-trip.
 */
export function SprintProgress({
  sprintId,
  goals,
  participants,
  progress,
  meId,
  isAdmin,
}: {
  sprintId: string;
  goals: SprintGoal[];
  participants: RacePerson[];
  progress: { goal_id: string; user_id: string }[];
  meId: string;
  isAdmin: boolean;
}) {
  const { run } = useAction();
  const [done, setDone] = useState(
    () => new Set(progress.map((p) => `${p.goal_id}:${p.user_id}`))
  );

  // Adopted during render, not in an effect — see board.tsx. An effect would
  // commit the stale set first, flashing a just-ticked goal back for a frame.
  const [seenProgress, setSeenProgress] = useState(progress);
  if (seenProgress !== progress) {
    setSeenProgress(progress);
    setDone(new Set(progress.map((p) => `${p.goal_id}:${p.user_id}`)));
  }

  const iParticipate = participants.some((p) => p.id === meId);
  const myDone = goals.filter((g) => done.has(`${g.id}:${meId}`)).length;
  const upNext = goals.find((g) => !done.has(`${g.id}:${meId}`));

  function toggle(goalId: string, next: boolean) {
    const key = `${goalId}:${meId}`;
    const flip = (add: boolean) =>
      setDone((prev) => {
        const copy = new Set(prev);
        if (add) copy.add(key);
        else copy.delete(key);
        return copy;
      });
    run(() => toggleGoalProgress(goalId, sprintId, next), {
      optimistic: () => flip(next),
      rollback: () => flip(!next),
    });
  }

  const hasSetup = goals.length > 0 && participants.length > 0;

  return (
    <>
      {iParticipate && goals.length > 0 && (
        <Panel>
          <PanelHeader
            title="Your goals"
            action={
              <span className="font-mono text-xs text-muted">
                {myDone}/{goals.length} done
              </span>
            }
          />
          {/* Your track: the sprint as a journey line. Done stops fill and
              light the rail behind you; the ringed stop is where you are. */}
          <ol className="px-4 py-2">
            {goals.map((goal, index) => {
              const isDone = done.has(`${goal.id}:${meId}`);
              const isCurrent = upNext?.id === goal.id;
              const prevDone =
                index > 0 && done.has(`${goals[index - 1].id}:${meId}`);
              return (
                <li key={goal.id} className="relative">
                  {index > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[11px] top-0 h-[calc(50%-12px)] w-px transition-colors duration-200",
                        prevDone ? "bg-primary/70" : "bg-line"
                      )}
                    />
                  )}
                  {index < goals.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute bottom-0 left-[11px] h-[calc(50%-12px)] w-px transition-colors duration-200",
                        isDone ? "bg-primary/70" : "bg-line"
                      )}
                    />
                  )}
                  <button
                    type="button"
                    aria-pressed={isDone}
                    aria-label={`${goal.title}: ${isDone ? "done — click to untick" : "mark done"}`}
                    onClick={() => toggle(goal.id, !isDone)}
                    className="flex w-full items-center gap-3 rounded-md px-0.5 py-2 text-left transition-colors duration-150 hover:bg-raised/40"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
                        isDone
                          ? "bg-primary text-primary-ink"
                          : isCurrent
                            ? "border-2 border-primary/70 bg-surface"
                            : "border border-line-strong bg-surface"
                      )}
                    >
                      {isDone ? (
                        <Check className="size-3" />
                      ) : isCurrent ? (
                        <span className="size-1.5 rounded-full bg-primary/70" />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm transition-colors duration-150",
                        isDone
                          ? "text-faint"
                          : isCurrent
                            ? "font-medium text-ink"
                            : "text-muted"
                      )}
                    >
                      {goal.title}
                    </span>
                    {isCurrent && (
                      <span className="shrink-0 font-mono text-[11px] text-primary-dim">
                        now
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Standings"
          action={
            hasSetup ? (
              <span className="font-mono text-xs text-muted">
                {participants.length} {participants.length === 1 ? "person" : "people"} ·{" "}
                {goals.length} goals
              </span>
            ) : undefined
          }
        />
        {hasSetup ? (
          <RaceStandings
            participants={participants}
            goals={goals}
            done={done}
            meId={meId}
          />
        ) : (
          <p className="p-4 text-[13px] text-faint">
            {isAdmin
              ? "Add goals and participants from the Edit page to start the race."
              : "Goals and participants haven't been set up yet."}
          </p>
        )}
      </Panel>
    </>
  );
}
