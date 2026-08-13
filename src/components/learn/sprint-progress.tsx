"use client";

import { useMemo, useState } from "react";
import { toggleGoalProgress } from "@/lib/actions/learn";
import { useAction } from "@/lib/use-action";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RaceStandings, type RacePerson } from "@/components/learn/race-standings";
import { SprintStages } from "@/components/learn/sprint-stages";
import { StageRail } from "@/components/learn/stage-rail";
import { buildStageViews, toRailStops } from "@/lib/learn";
import type { SprintGoal, SprintResource, SprintStage } from "@/lib/types";

/**
 * One owner for the sprint's tick state: the stage stack, the rail, and the
 * standings race all read the same optimistic done-set, so a tick clears a
 * stage, advances the rail, and moves your lane in the same frame — no waiting
 * on the server round-trip.
 */
export function SprintProgress({
  sprintId,
  stages,
  goals,
  resources,
  participants,
  progress,
  meId,
  isAdmin,
}: {
  sprintId: string;
  stages: SprintStage[];
  goals: SprintGoal[];
  resources: SprintResource[];
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

  const views = useMemo(
    () => buildStageViews(stages, goals, (goalId) => done.has(`${goalId}:${meId}`)),
    [stages, goals, done, meId]
  );

  // Only stage-scoped resources land here; the sprint-wide ones stay on the
  // page's own shelf.
  const resourcesByStage = useMemo(() => {
    const map = new Map<string, SprintResource[]>();
    for (const resource of resources) {
      if (!resource.stage_id) continue;
      const list = map.get(resource.stage_id);
      if (list) list.push(resource);
      else map.set(resource.stage_id, [resource]);
    }
    return map;
  }, [resources]);

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

  const myDone = goals.filter((g) => done.has(`${g.id}:${meId}`)).length;
  const clearedStages = views.filter((v) => v.cleared).length;
  const currentView = views.find((v) => v.current);
  const hasSetup = goals.length > 0 && participants.length > 0;
  const hasStages = views.length > 0;

  return (
    <>
      {hasStages && (
        <section aria-label="Your progress" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-sm font-semibold text-ink">
              {iParticipate ? "Your run" : "The run"}
            </h2>
            <p className="font-mono text-xs text-faint">
              {views.length > 1 && (
                <>
                  {clearedStages}/{views.length} stages
                  <span aria-hidden> · </span>
                </>
              )}
              {myDone}/{goals.length} goals
            </p>
          </div>

          {views.length > 1 && (
            <div className="flex items-center gap-3">
              <StageRail stops={toRailStops(views)} className="min-w-0 flex-1" />
            </div>
          )}

          {currentView && iParticipate && (
            <p className="text-[13px] text-muted">
              Next:{" "}
              <span className="text-ink">
                {currentView.goals.find((g) => !done.has(`${g.id}:${meId}`))?.title ??
                  (currentView.proof && !done.has(`${currentView.proof.id}:${meId}`)
                    ? currentView.proof.title
                    : currentView.stage?.title) ??
                  "—"}
              </span>
            </p>
          )}

          <SprintStages
            views={views}
            resourcesByStage={resourcesByStage}
            isDone={(goalId) => done.has(`${goalId}:${meId}`)}
            onToggle={toggle}
            readOnly={!iParticipate}
          />
        </section>
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
