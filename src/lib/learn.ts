import type { SprintGoal, SprintResource, SprintStage } from "@/lib/types";
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
    //
    // A proof only exists inside a stage: it's handed in against that stage
    // (0061), and a stage-less one would render a hand-in box with nowhere to
    // file the result. In the unstaged block such a goal stays an ordinary
    // ticked line, which is what it was before it was flagged.
    const proof = stage ? (stageGoals.find((g) => g.is_proof) ?? null) : null;
    const plain = stageGoals.filter((g) => g !== proof);
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

/** "days 5–7", "day 14", or null when the stage is undated. */
export function stageDays(stage: SprintStage | null): string | null {
  if (!stage || stage.day_from === null) return null;
  return stage.day_to !== null && stage.day_to !== stage.day_from
    ? `days ${stage.day_from}–${stage.day_to}`
    : `day ${stage.day_from}`;
}

/** "6–7 hrs", "4 hrs", or null when the stage is unestimated. */
export function stageHours(stage: SprintStage | null): string | null {
  if (!stage || stage.hours_low === null) return null;
  return stage.hours_high !== null && stage.hours_high !== stage.hours_low
    ? `${stage.hours_low}–${stage.hours_high} hrs`
    : `${stage.hours_low} hrs`;
}

/* --------------------------------------------------------------- techniques */

/** One resource in a goal's run, carrying the number it's known by. */
export type Technique = {
  resource: SprintResource;
  /** 1-based, counted across the whole stage — see `buildTechniques`. */
  index: number;
};

/**
 * Goal id → the resources that teach it, in order and numbered.
 *
 * The number counts across the stage rather than restarting under each goal.
 * These eighteen videos are referred to by position — "technique 14" is the
 * name that one has — and four runs of 01–06 would take that name away to buy
 * nothing. A goal with nothing attached is absent from the map rather than
 * present and empty, so the caller's check is one lookup.
 *
 * Goals arrive sorted by `sort_order` across the whole sprint, and a stage's
 * goals are contiguous within it, so one counter per stage id is enough — no
 * grouping pass, and unstaged goals get a run of their own for free.
 */
export function buildTechniques(
  goals: SprintGoal[],
  resources: SprintResource[]
): Map<string, Technique[]> {
  const byGoal = new Map<string, SprintResource[]>();
  for (const resource of resources) {
    if (!resource.goal_id) continue;
    const list = byGoal.get(resource.goal_id);
    if (list) list.push(resource);
    else byGoal.set(resource.goal_id, [resource]);
  }
  if (byGoal.size === 0) return new Map();

  const counters = new Map<string, number>();
  const out = new Map<string, Technique[]>();
  for (const goal of goals) {
    const items = byGoal.get(goal.id);
    if (!items) continue;
    const key = goal.stage_id ?? UNSTAGED_ID;
    let n = counters.get(key) ?? 0;
    out.set(
      goal.id,
      items.map((resource) => ({ resource, index: ++n }))
    );
    counters.set(key, n);
  }
  return out;
}

/* --------------------------------------------------------------- milestones */

/** One stage's gate, as a dated stop you either have or haven't cleared. */
export type Milestone = {
  /** The stage id (or "unstaged"), so the stop links back to its block. */
  id: string;
  /** "day 14" or "days 5–7". Null when the stage is undated. */
  day: string | null;
  title: string;
  /** What clearing it takes. Null when the stage states no proof. */
  proof: string | null;
  done: boolean;
  /** The stage you're on: the first one not cleared. */
  current: boolean;
  capstone: boolean;
  /** Goals ticked / goals in the stage. Carried here rather than derived
      alongside, so the phone's stage sheet can't drift from the rail. */
  doneCount: number;
  total: number;
};

/**
 * The milestone list is derived, never stored: it's each stage's proof, dated
 * by that stage's own days. A stage with a proof goal reports that goal's tick;
 * a stage with only prose proof falls back to "the whole stage is cleared",
 * which is the same claim by a longer route.
 *
 * Every stage gets a stop, proof or not. These stops are the page's top nav as
 * well as its scorecard, and an index that skipped a stage would strand it.
 */
export function buildMilestones(
  views: StageView[],
  isDone: (goalId: string) => boolean
): Milestone[] {
  return views.map((view) => ({
    id: stageViewId(view),
    day: stageDays(view.stage),
    title: view.stage?.title ?? "Goals",
    proof: view.proof?.title ?? view.stage?.proof ?? null,
    done: view.proof ? isDone(view.proof.id) : view.cleared,
    current: view.current,
    capstone: view.stage?.kind === "capstone",
    doneCount: view.doneCount,
    total: view.total,
  }));
}

/* -------------------------------------------------------------------- stats */

/**
 * The four numbers a program leads with. Every one is counted from rows that
 * already exist — nothing here is a field an admin can forget to update, so the
 * headline can't drift from the run underneath it.
 */
export type ProgramStats = {
  days: number;
  stages: number;
  capstones: number;
  hoursLow: number;
  hoursHigh: number;
};

export function programStats(stages: SprintStage[], days: number): ProgramStats {
  let hoursLow = 0;
  let hoursHigh = 0;
  for (const stage of stages) {
    hoursLow += stage.hours_low ?? 0;
    hoursHigh += stage.hours_high ?? stage.hours_low ?? 0;
  }
  return {
    days,
    stages: stages.filter((s) => s.kind !== "capstone").length,
    capstones: stages.filter((s) => s.kind === "capstone").length,
    hoursLow,
    hoursHigh,
  };
}

/** "~28" or "22–27" — the estimate as one short string, or null if unestimated. */
export function hoursLabel(stats: ProgramStats): string | null {
  if (stats.hoursHigh === 0) return null;
  return stats.hoursLow === stats.hoursHigh
    ? `${stats.hoursLow}`
    : `${stats.hoursLow}–${stats.hoursHigh}`;
}
