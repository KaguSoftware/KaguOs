import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus, Users } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { JoinSprintButton } from "@/components/learn/join-sprint-button";
import { StageRail } from "@/components/learn/stage-rail";
import { buildStageViews, toRailStops } from "@/lib/learn";
import { formatDate, todayInIstanbul } from "@/lib/utils";
import type { SprintGoal, SprintStage } from "@/lib/types";

export const metadata: Metadata = { title: "Learn" };

const DAY_MS = 24 * 60 * 60 * 1000;

type SprintRow = {
  id: string;
  title: string;
  description: string | null;
  starts_on: string;
  ends_on: string;
  join_mode: "assigned" | "open";
  sprint_participants: { user_id: string }[];
};

type Phase = "active" | "upcoming" | "past";

function phaseOf(sprint: SprintRow, today: string): Phase {
  if (today < sprint.starts_on) return "upcoming";
  if (today > sprint.ends_on) return "past";
  return "active";
}

export default async function LearnPage() {
  const ctx = await requireSection("learn");

  // One wave. Goals and stages come back for every sprint at once rather than
  // per-card, because the rail on each card is derived from them.
  const [sprints, allProgress, allGoals, allStages] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("sprints")
        .select(
          "id, title, description, starts_on, ends_on, join_mode, sprint_participants(user_id)"
        )
        .eq("is_demo", ctx.showcase)
        .order("starts_on", { ascending: false }),
      "sprints"
    ),
    // Everyone's ticks, not just mine — the rows feed both your rail and the
    // team completion figure.
    rowsOrThrow(
      ctx.supabase
        .from("sprint_goal_progress")
        .select("goal_id, user_id, sprint_goals!inner(sprint_id)")
        .eq("is_demo", ctx.showcase),
      "sprint_goal_progress"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("sprint_goals")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("sort_order")
        .order("created_at"),
      "sprint_goals"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("sprint_stages")
        .select("*")
        .eq("is_demo", ctx.showcase)
        .order("sort_order"),
      "sprint_stages"
    ),
  ]);

  const goalsBySprint = new Map<string, SprintGoal[]>();
  for (const goal of allGoals as SprintGoal[]) {
    const list = goalsBySprint.get(goal.sprint_id);
    if (list) list.push(goal);
    else goalsBySprint.set(goal.sprint_id, [goal]);
  }
  const stagesBySprint = new Map<string, SprintStage[]>();
  for (const stage of allStages as SprintStage[]) {
    const list = stagesBySprint.get(stage.sprint_id);
    if (list) list.push(stage);
    else stagesBySprint.set(stage.sprint_id, [stage]);
  }

  const myDoneGoals = new Set<string>();
  const doneBySprint = new Map<string, { user_id: string }[]>();
  for (const row of allProgress) {
    const sprintId = (row.sprint_goals as unknown as { sprint_id: string }).sprint_id;
    if (row.user_id === ctx.userId) myDoneGoals.add(row.goal_id);
    const list = doneBySprint.get(sprintId) ?? [];
    list.push({ user_id: row.user_id });
    doneBySprint.set(sprintId, list);
  }

  const today = todayInIstanbul();
  const rows = sprints as SprintRow[];
  // A view-only Learn member can read every sprint but can't tick a goal, so
  // offering them Join would seat them in the standings as a spectator.
  const mayJoin = canWrite(ctx, "learn");

  const mine = rows.filter((s) =>
    s.sprint_participants.some((sp) => sp.user_id === ctx.userId)
  );
  const minePhase = (s: SprintRow) => phaseOf(s, today);

  // "Yours" is the working set: what's running now and what's coming. A sprint
  // you finished is a record, and records live in Past with everyone else's.
  const yours = mine
    .filter((s) => minePhase(s) !== "past")
    .sort((a, b) => {
      const order = { active: 0, upcoming: 1, past: 2 } as const;
      const byPhase = order[minePhase(a)] - order[minePhase(b)];
      return byPhase !== 0 ? byPhase : a.starts_on.localeCompare(b.starts_on);
    });

  const openToJoin = rows
    .filter(
      (s) =>
        s.join_mode === "open" &&
        phaseOf(s, today) !== "past" &&
        !s.sprint_participants.some((sp) => sp.user_id === ctx.userId)
    )
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));

  const past = rows
    .filter((s) => phaseOf(s, today) === "past")
    .sort((a, b) => b.starts_on.localeCompare(a.starts_on));

  const nothingAtAll =
    yours.length === 0 && openToJoin.length === 0 && past.length === 0;

  function railFor(sprint: SprintRow) {
    const goals = goalsBySprint.get(sprint.id) ?? [];
    const stages = stagesBySprint.get(sprint.id) ?? [];
    const views = buildStageViews(stages, goals, (goalId) => myDoneGoals.has(goalId));
    return { views, stops: toRailStops(views), goals };
  }

  return (
    <>
      <LiveRefresh
        tables={["sprints", "sprint_goal_progress", "sprint_goals", "sprint_stages"]}
      />
      <PageHeader
        title="Kagu Learn"
        description="Learning sprints — planned for the people who need them."
        action={
          ctx.isAdmin ? (
            <LinkButton href="/learn/new">
              <Plus className="size-3.5" aria-hidden />
              New sprint
            </LinkButton>
          ) : undefined
        }
      />

      {nothingAtAll ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={GraduationCap}
            title="No sprints yet"
            hint={
              ctx.isAdmin
                ? "Create the first learning sprint and pick who it's for."
                : "When a sprint is planned for you, it shows up here."
            }
          />
        </div>
      ) : (
        <div className="grid gap-10">
          {/* ---- Yours: the only section that gets full cards. Anything you're
              not in doesn't earn the same pixels. */}
          <section aria-labelledby="yours-heading">
            <h2
              id="yours-heading"
              className="mb-3 font-mono text-xs uppercase tracking-wider text-faint"
            >
              Yours
            </h2>
            {yours.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[calc(13px*var(--text-scale,1))] text-faint">
                {openToJoin.length > 0
                  ? "Nothing running. Join one below."
                  : "Nothing running for you right now."}
              </p>
            ) : (
              <ul className="grid gap-3">
                {yours.map((sprint) => {
                  const { views, stops, goals } = railFor(sprint);
                  const phase = minePhase(sprint);
                  const myDone = goals.filter((g) => myDoneGoals.has(g.id)).length;
                  const current = views.find((v) => v.current);
                  const nextGoal =
                    current &&
                    [...current.goals, ...(current.proof ? [current.proof] : [])].find(
                      (g) => !myDoneGoals.has(g.id)
                    );

                  const totalDays =
                    Math.round(
                      (Date.parse(sprint.ends_on) - Date.parse(sprint.starts_on)) / DAY_MS
                    ) + 1;
                  const dayOf = Math.min(
                    totalDays,
                    Math.max(
                      1,
                      Math.round(
                        (Date.parse(today) - Date.parse(sprint.starts_on)) / DAY_MS
                      ) + 1
                    )
                  );
                  const daysUntil = Math.round(
                    (Date.parse(sprint.starts_on) - Date.parse(today)) / DAY_MS
                  );

                  return (
                    <li key={sprint.id}>
                      <Link
                        href={`/learn/${sprint.id}`}
                        className="block rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-raised/30"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <p className="min-w-0 text-sm font-medium text-ink">
                            {sprint.title}
                          </p>
                          <p className="font-mono text-xs text-faint">
                            {phase === "active"
                              ? `day ${dayOf} of ${totalDays}`
                              : daysUntil === 1
                                ? "starts tomorrow"
                                : `starts in ${daysUntil} days`}
                          </p>
                        </div>

                        {stops.length > 1 && (
                          <div className="mt-3">
                            <StageRail stops={stops} size="sm" />
                          </div>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                          {current?.stage && (
                            <p className="min-w-0 text-[calc(13px*var(--text-scale,1))] text-muted">
                              <span className="text-ink">{current.stage.title}</span>
                              {nextGoal && (
                                <span className="text-faint"> · {nextGoal.title}</span>
                              )}
                            </p>
                          )}
                          {!current && goals.length > 0 && (
                            <p className="text-[calc(13px*var(--text-scale,1))] text-primary-dim">
                              All goals done
                            </p>
                          )}
                          <p className="ml-auto flex shrink-0 items-center gap-3 font-mono text-xs text-faint">
                            {goals.length > 0 && (
                              <span>
                                {myDone}/{goals.length}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users className="size-3.5" aria-hidden />
                              {sprint.sprint_participants.length}
                            </span>
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ---- Open to join: the catalogue proper. */}
          {openToJoin.length > 0 && (
            <section aria-labelledby="open-heading">
              <h2
                id="open-heading"
                className="mb-3 font-mono text-xs uppercase tracking-wider text-faint"
              >
                Open to join
              </h2>
              <ul className="grid gap-3">
                {openToJoin.map((sprint) => {
                  const { stops, goals } = railFor(sprint);
                  const stageCount = stagesBySprint.get(sprint.id)?.length ?? 0;
                  const totalDays =
                    Math.round(
                      (Date.parse(sprint.ends_on) - Date.parse(sprint.starts_on)) / DAY_MS
                    ) + 1;
                  const daysUntil = Math.round(
                    (Date.parse(sprint.starts_on) - Date.parse(today)) / DAY_MS
                  );
                  const meta = [
                    stageCount > 0
                      ? `${stageCount} stages`
                      : goals.length > 0
                        ? `${goals.length} goals`
                        : null,
                    `${totalDays} days`,
                    daysUntil > 0
                      ? daysUntil === 1
                        ? "starts tomorrow"
                        : `starts in ${daysUntil} days`
                      : "running now",
                  ].filter(Boolean);

                  return (
                    <li
                      key={sprint.id}
                      className="rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/learn/${sprint.id}`}
                            className="text-sm font-medium text-ink underline-offset-4 hover:underline"
                          >
                            {sprint.title}
                          </Link>
                          <p className="mt-0.5 font-mono text-xs text-faint">
                            {meta.join(" · ")}
                          </p>
                          {sprint.description && (
                            <p className="mt-2 line-clamp-2 max-w-[70ch] text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
                              {sprint.description}
                            </p>
                          )}
                        </div>
                        {mayJoin && (
                          <JoinSprintButton
                            sprintId={sprint.id}
                            joined={false}
                            canLeave={daysUntil > 0}
                          />
                        )}
                      </div>

                      {stops.length > 1 && (
                        <div className="mt-3 flex items-center gap-3">
                          <StageRail stops={stops} size="sm" className="min-w-0 flex-1" />
                          <span className="shrink-0 font-mono text-xs text-faint">
                            {sprint.sprint_participants.length} joined
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ---- Past: records, not destinations. One dense line each. */}
          {past.length > 0 && (
            <section aria-labelledby="past-heading">
              <h2
                id="past-heading"
                className="mb-3 font-mono text-xs uppercase tracking-wider text-faint"
              >
                Past
              </h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {past.map((sprint) => {
                  const goals = goalsBySprint.get(sprint.id) ?? [];
                  const wasMine = sprint.sprint_participants.some(
                    (sp) => sp.user_id === ctx.userId
                  );
                  const myDone = goals.filter((g) => myDoneGoals.has(g.id)).length;
                  return (
                    <li key={sprint.id}>
                      <Link
                        href={`/learn/${sprint.id}`}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 transition-colors duration-150 hover:bg-raised/40"
                      >
                        <span className="min-w-0 flex-1 truncate text-[calc(13px*var(--text-scale,1))] text-muted">
                          {sprint.title}
                        </span>
                        <span className="font-mono text-xs text-faint">
                          {formatDate(sprint.ends_on)}
                        </span>
                        {wasMine && goals.length > 0 && (
                          <Badge tone={myDone === goals.length ? "green" : "faint"}>
                            {myDone}/{goals.length}
                          </Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
