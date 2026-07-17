"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toggleGoalProgress } from "@/lib/actions/learn";
import { useAction } from "@/lib/use-action";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RaceStandings, type RacePerson } from "@/components/learn/race-standings";
import { ProgressGrid } from "@/components/learn/progress-grid";
import { cn } from "@/lib/utils";
import type { SprintGoal } from "@/lib/types";

/**
 * One owner for the sprint's tick state. Your checklist, the standings race,
 * and the per-goal grid all read the same optimistic done-set, so a tick moves
 * your lane the moment you click — no waiting on the server round-trip.
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
  const { pending, run } = useAction();
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
          <ul className="divide-y divide-line">
            {goals.map((goal) => {
              const isDone = done.has(`${goal.id}:${meId}`);
              return (
                <li key={goal.id}>
                  <button
                    type="button"
                    aria-pressed={isDone}
                    onClick={() => toggle(goal.id, !isDone)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-raised/60"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
                        isDone
                          ? "border-primary/40 bg-primary text-primary-ink"
                          : "border-line-strong text-transparent"
                      )}
                    >
                      <Check className="size-3.5" />
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        isDone
                          ? "text-muted line-through decoration-faint"
                          : "text-ink"
                      )}
                    >
                      {goal.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {hasSetup && participants.length > 1 && (
        <Panel>
          <PanelHeader title="Standings" />
          <RaceStandings
            participants={participants}
            goalCount={goals.length}
            done={done}
            meId={meId}
          />
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title={`Team progress (${participants.length} ${
            participants.length === 1 ? "person" : "people"
          })`}
        />
        {hasSetup ? (
          <ProgressGrid
            goals={goals}
            participants={participants}
            done={done}
            meId={meId}
            iParticipate={iParticipate}
            pending={pending}
            onToggle={toggle}
          />
        ) : (
          <p className="p-4 text-[13px] text-faint">
            {isAdmin
              ? "Add goals and participants from the Edit page to start tracking."
              : "Goals and participants haven't been set up yet."}
          </p>
        )}
      </Panel>
    </>
  );
}
