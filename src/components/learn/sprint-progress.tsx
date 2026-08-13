"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Flag } from "lucide-react";
import { toggleGoalProgress, toggleResourceWatched } from "@/lib/actions/learn";
import { useAction } from "@/lib/use-action";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RaceStandings, type RacePerson } from "@/components/learn/race-standings";
import { SprintStages } from "@/components/learn/sprint-stages";
import { MilestoneNav } from "@/components/learn/milestone-nav";
import { ResourceRow } from "@/components/learn/resource-row";
import { buildMilestones, buildStageViews, buildTechniques } from "@/lib/learn";
import type {
  SprintGoal,
  SprintPractice,
  SprintProofCriterion,
  SprintProofSubmission,
  SprintResource,
  SprintStage,
} from "@/lib/types";

/**
 * One owner for everything this sprint remembers about you: goal ticks and
 * watched resources both live here, so clearing a stage advances the rail,
 * flips its milestone, and moves your lane in the standings in the same frame
 * — no waiting on a server round-trip for any of it.
 *
 * The two sets stay separate on purpose. Watching every video in a strand does
 * not clear it; doing the work does. Merging them would let a stage light up
 * for reading about it.
 */
export function SprintProgress({
  sprintId,
  stages,
  goals,
  resources,
  criteria,
  myProof,
  build,
  participants,
  progress,
  watched,
  meId,
  isAdmin,
  mayWrite,
  method,
  header,
}: {
  sprintId: string;
  stages: SprintStage[];
  goals: SprintGoal[];
  resources: SprintResource[];
  /** Every stage's acceptance conditions, in order. */
  criteria: SprintProofCriterion[];
  /** My hand-ins only — RLS keeps everyone else's out of this page. */
  myProof: SprintProofSubmission[];
  /** The capstone build timeline, shown inside the capstone's stage card. */
  build: SprintPractice[];
  participants: RacePerson[];
  progress: { goal_id: string; user_id: string }[];
  watched: { resource_id: string }[];
  meId: string;
  isAdmin: boolean;
  /** False for a view-only Learn member: the run is readable, not tickable. */
  mayWrite: boolean;
  /** Server-rendered "how to run this" block, slotted in after the stages. */
  method?: ReactNode;
  /**
   * The page's own title block. It's slotted in rather than rendered by the
   * page so the milestone bar can sit above it: the bar reads live ticks, which
   * only this component holds, and a sticky element has to come first in the
   * DOM to stick to the top of what follows it.
   */
  header?: ReactNode;
}) {
  const { run } = useAction();
  const [done, setDone] = useState(
    () => new Set(progress.map((p) => `${p.goal_id}:${p.user_id}`))
  );
  const [seen, setSeen] = useState(() => new Set(watched.map((w) => w.resource_id)));

  // Adopted during render, not in an effect — see board.tsx. An effect would
  // commit the stale set first, flashing a just-ticked row back for a frame.
  const [seenProgress, setSeenProgress] = useState(progress);
  if (seenProgress !== progress) {
    setSeenProgress(progress);
    setDone(new Set(progress.map((p) => `${p.goal_id}:${p.user_id}`)));
  }
  const [seenWatched, setSeenWatched] = useState(watched);
  if (seenWatched !== watched) {
    setSeenWatched(watched);
    setSeen(new Set(watched.map((w) => w.resource_id)));
  }

  const iParticipate = participants.some((p) => p.id === meId);
  const readOnly = !iParticipate || !mayWrite;

  const isDone = (goalId: string) => done.has(`${goalId}:${meId}`);
  const isWatched = (resourceId: string) => seen.has(resourceId);

  const views = useMemo(
    () => buildStageViews(stages, goals, (goalId) => done.has(`${goalId}:${meId}`)),
    [stages, goals, done, meId]
  );

  const milestones = useMemo(
    () => buildMilestones(views, (goalId) => done.has(`${goalId}:${meId}`)),
    [views, done, meId]
  );

  const techniques = useMemo(() => buildTechniques(goals, resources), [goals, resources]);

  // A resource belongs to exactly one place: under the goal it teaches, in its
  // stage's reading list, or on the shelf at the bottom. The three filters here
  // are that split, and a goal beats a stage — the narrower claim wins.
  const resourcesByStage = useMemo(() => {
    const map = new Map<string, SprintResource[]>();
    for (const resource of resources) {
      if (!resource.stage_id || resource.goal_id) continue;
      const list = map.get(resource.stage_id);
      if (list) list.push(resource);
      else map.set(resource.stage_id, [resource]);
    }
    return map;
  }, [resources]);

  const shelf = useMemo(
    () => resources.filter((r) => !r.stage_id && !r.goal_id),
    [resources]
  );

  const criteriaByStage = useMemo(() => {
    const map = new Map<string, SprintProofCriterion[]>();
    for (const criterion of criteria) {
      const list = map.get(criterion.stage_id);
      if (list) list.push(criterion);
      else map.set(criterion.stage_id, [criterion]);
    }
    return map;
  }, [criteria]);

  const proofByStage = useMemo(
    () => new Map(myProof.map((submission) => [submission.stage_id, submission])),
    [myProof]
  );

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

  // Handing a proof in clears the stage, so the rail, the milestone and the
  // standings all have to move on the same frame the box empties. The server
  // action writes the same progress row; this is just its optimistic half.
  // The action owns the rollback, so a rejected hand-in undoes the tick too.
  function flipProofTick(goalId: string | null, add: boolean) {
    if (!goalId) return;
    const key = `${goalId}:${meId}`;
    setDone((prev) => {
      const copy = new Set(prev);
      if (add) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  }

  function toggleWatched(resourceId: string, next: boolean) {
    const flip = (add: boolean) =>
      setSeen((prev) => {
        const copy = new Set(prev);
        if (add) copy.add(resourceId);
        else copy.delete(resourceId);
        return copy;
      });
    run(() => toggleResourceWatched(resourceId, sprintId, next), {
      optimistic: () => flip(next),
      rollback: () => flip(!next),
    });
  }

  const myDone = goals.filter((g) => isDone(g.id)).length;
  const clearedStages = views.filter((v) => v.cleared).length;
  const currentView = views.find((v) => v.current);
  const finished = views.length > 0 && clearedStages === views.length;
  const hasSetup = goals.length > 0 && participants.length > 0;
  const nextGoal = currentView
    ? [...currentView.goals, ...(currentView.proof ? [currentView.proof] : [])].find(
        (g) => !isDone(g.id)
      )
    : undefined;

  return (
    <>
      <MilestoneNav milestones={milestones} />
      {header}

      {views.length > 0 && (
        <section aria-label="Your progress" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-sm font-semibold text-ink">
              {iParticipate ? "Your run" : "The run"}
            </h2>
            <p className="font-mono text-xs tabular-nums text-faint">
              {views.length > 1 && (
                <>
                  {clearedStages}/{views.length} stages
                  <span aria-hidden> · </span>
                </>
              )}
              {myDone}/{goals.length} goals
            </p>
          </div>

          {finished ? (
            <p className="flex items-center gap-2 text-[13px] text-primary-dim">
              <Flag className="size-3.5 shrink-0" aria-hidden />
              Every stage cleared. That&apos;s the whole program.
            </p>
          ) : (
            currentView &&
            iParticipate && (
              <p className="text-[13px] text-muted">
                Next:{" "}
                <span className="text-ink">
                  {nextGoal?.title ?? currentView.stage?.title ?? "—"}
                </span>
              </p>
            )
          )}

          <SprintStages
            sprintId={sprintId}
            meId={meId}
            views={views}
            build={build}
            resourcesByStage={resourcesByStage}
            criteriaByStage={criteriaByStage}
            myProof={proofByStage}
            techniques={techniques}
            isDone={isDone}
            onToggle={toggle}
            onProofSent={(goalId) => flipProofTick(goalId, true)}
            onProofWithdrawn={(goalId) => flipProofTick(goalId, false)}
            isWatched={isWatched}
            onToggleWatched={toggleWatched}
            readOnly={readOnly}
          />
        </section>
      )}

      {method}

      {shelf.length > 0 && (
        <Panel>
          <PanelHeader title="Also keep open" />
          <ul className="grid p-3.5 sm:p-4">
            {shelf.map((resource) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                watched={isWatched(resource.id)}
                readOnly={readOnly}
                onToggle={toggleWatched}
              />
            ))}
          </ul>
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
