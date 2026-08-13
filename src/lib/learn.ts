import type { SprintGoal, SprintStage } from "@/lib/types";
import type { RailStop } from "@/components/learn/stage-rail";

/** A stage plus one person's standing in it. */
export type StageView = {
  stage: SprintStage | null;
  /** Non-proof goals, in order. */
  goals: SprintGoal[];
  /** The stage's proof goal, if it has one. */
  proof: SprintGoal | null;
  doneCount: number;
  total: number;
  /** Every goal ticked, proof included. */
  cleared: boolean;
  /** The first stage that isn't cleared — the one you're on. */
  current: boolean;
};

/** Goals that predate stages, or were never filed into one. */
const UNSTAGED_ID = "unstaged";

export function stageViewId(view: StageView) {
  return view.stage?.id ?? UNSTAGED_ID;
}

/**
 * Fold a sprint's stages, goals and one person's ticks into the shape both the
 * rail and the stage stack read from. Sprints created before stages existed
 * have goals with a null `stage_id`; those collapse into a single leading
 * stage-less view, so nothing needs backfilling to render.
 *
 * "Cleared" is derived, never stored — it's just every goal in the stage ticked
 * by this person.
 */
export function buildStageViews(
  stages: SprintStage[],
  goals: SprintGoal[],
  isDone: (goalId: string) => boolean
): StageView[] {
  const byStage = new Map<string, SprintGoal[]>();
  for (const goal of goals) {
    const key = goal.stage_id ?? UNSTAGED_ID;
    const list = byStage.get(key);
    if (list) list.push(goal);
    else byStage.set(key, [goal]);
  }

  const views: StageView[] = [];

  const push = (stage: SprintStage | null, stageGoals: SprintGoal[]) => {
    // An empty stage still renders (an admin may have just created it), but it
    // is never "cleared" — clearing nothing would light the rail for free.
    const proof = stageGoals.find((g) => g.is_proof) ?? null;
    const plain = stageGoals.filter((g) => !g.is_proof);
    const total = stageGoals.length;
    const doneCount = stageGoals.filter((g) => isDone(g.id)).length;
    views.push({
      stage,
      goals: plain,
      proof,
      doneCount,
      total,
      cleared: total > 0 && doneCount === total,
      current: false,
    });
  };

  const unstaged = byStage.get(UNSTAGED_ID);
  if (unstaged && unstaged.length > 0) push(null, unstaged);
  for (const stage of stages) push(stage, byStage.get(stage.id) ?? []);

  // You are on the first stage you haven't cleared. When everything is cleared
  // nothing is current — the sprint is behind you, and marking a "current"
  // stage then would point at a finished thing.
  const currentIndex = views.findIndex((v) => !v.cleared);
  if (currentIndex !== -1) views[currentIndex].current = true;

  return views;
}

export function toRailStops(views: StageView[]): RailStop[] {
  return views.map((view) => ({
    id: stageViewId(view),
    title: view.stage?.title ?? "Goals",
    done: view.cleared,
    current: view.current,
    capstone: view.stage?.kind === "capstone",
  }));
}

/** "days 5–7 · 6–7 hrs" — whichever halves exist. */
export function stageMeta(stage: SprintStage | null): string | null {
  if (!stage) return null;
  const parts: string[] = [];
  if (stage.day_from !== null) {
    parts.push(
      stage.day_to !== null && stage.day_to !== stage.day_from
        ? `days ${stage.day_from}–${stage.day_to}`
        : `day ${stage.day_from}`
    );
  }
  if (stage.hours_low !== null) {
    parts.push(
      stage.hours_high !== null && stage.hours_high !== stage.hours_low
        ? `${stage.hours_low}–${stage.hours_high} hrs`
        : `${stage.hours_low} hrs`
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
