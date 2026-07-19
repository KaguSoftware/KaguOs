import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus, Users } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { formatDate, todayInIstanbul } from "@/lib/utils";

export const metadata: Metadata = { title: "Learn" };

const DAY_MS = 24 * 60 * 60 * 1000;

type SprintRow = {
  id: string;
  title: string;
  description: string | null;
  starts_on: string;
  ends_on: string;
  sprint_participants: { user_id: string }[];
  sprint_goals: { count: number }[];
};

type Phase = "active" | "upcoming" | "past";

function phaseOf(sprint: SprintRow, today: string): Phase {
  if (today < sprint.starts_on) return "upcoming";
  if (today > sprint.ends_on) return "past";
  return "active";
}

const GROUPS: { phase: Phase; label: string }[] = [
  { phase: "active", label: "Active" },
  { phase: "upcoming", label: "Upcoming" },
  { phase: "past", label: "Past" },
];

export default async function LearnPage() {
  const ctx = await requireSection("learn");

  const [{ data: sprints }, { data: allProgress }] = await Promise.all([
    ctx.supabase
      .from("sprints")
      .select(
        "id, title, description, starts_on, ends_on, sprint_participants(user_id), sprint_goals(count)"
      )
      .eq("is_demo", ctx.showcase)
      .order("starts_on", { ascending: false }),
    // Everyone's ticks, not just mine — the rows feed both the personal bar
    // and the team completion figure. Same wave, still two queries.
    ctx.supabase
      .from("sprint_goal_progress")
      .select("goal_id, user_id, sprint_goals!inner(sprint_id)")
      .eq("is_demo", ctx.showcase),
  ]);

  const myDoneBySprint = new Map<string, number>();
  const doneBySprint = new Map<string, { user_id: string }[]>();
  for (const row of allProgress ?? []) {
    const sprintId = (row.sprint_goals as unknown as { sprint_id: string }).sprint_id;
    if (row.user_id === ctx.userId) {
      myDoneBySprint.set(sprintId, (myDoneBySprint.get(sprintId) ?? 0) + 1);
    }
    const list = doneBySprint.get(sprintId) ?? [];
    list.push({ user_id: row.user_id });
    doneBySprint.set(sprintId, list);
  }

  const today = todayInIstanbul();
  const rows = (sprints ?? []) as SprintRow[];
  const groups = GROUPS.map((group) => ({
    ...group,
    sprints: rows
      .filter((s) => phaseOf(s, today) === group.phase)
      .sort((a, b) =>
        group.phase === "upcoming"
          ? a.starts_on < b.starts_on
            ? -1
            : 1
          : a.starts_on < b.starts_on
            ? 1
            : -1
      ),
  })).filter((group) => group.sprints.length > 0);

  return (
    <>
      <LiveRefresh tables={["sprints", "sprint_goal_progress"]} />
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

      <div className="rounded-lg border border-line bg-surface">
        {groups.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No sprints yet"
            hint={
              ctx.isAdmin
                ? "Create the first learning sprint and pick who it's for."
                : "When a sprint is planned for you, it shows up here."
            }
          />
        ) : (
          <div className="divide-y divide-line">
            {groups.map((group) => (
              <section key={group.phase} aria-label={group.label}>
                <p className="border-b border-line px-4 py-2 text-xs font-medium text-faint">
                  {group.label}
                </p>
                <ul className="divide-y divide-line">
                  {group.sprints.map((sprint) => {
                    const mine = sprint.sprint_participants.some(
                      (sp) => sp.user_id === ctx.userId
                    );
                    const goalCount = sprint.sprint_goals[0]?.count ?? 0;
                    const myDone = myDoneBySprint.get(sprint.id) ?? 0;
                    const participantCount = sprint.sprint_participants.length;

                    const participantSet = new Set(
                      sprint.sprint_participants.map((sp) => sp.user_id)
                    );
                    const teamDone = (doneBySprint.get(sprint.id) ?? []).filter((p) =>
                      participantSet.has(p.user_id)
                    ).length;
                    const teamCells = goalCount * participantCount;
                    const teamPct =
                      teamCells > 0 ? Math.round((teamDone / teamCells) * 100) : null;

                    const daysLeft = Math.round(
                      (Date.parse(sprint.ends_on) - Date.parse(today)) / DAY_MS
                    );
                    const meta = [
                      `${formatDate(sprint.starts_on)} → ${formatDate(sprint.ends_on)}`,
                      `${goalCount} goals`,
                      group.phase === "active" &&
                        (daysLeft === 0 ? "last day" : `${daysLeft}d left`),
                      teamPct !== null && `team ${teamPct}%`,
                    ].filter(Boolean);

                    return (
                      <li key={sprint.id}>
                        <Link
                          href={`/learn/${sprint.id}`}
                          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-raised/60"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink">
                              {sprint.title}
                            </p>
                            <p className="mt-0.5 text-xs text-faint">
                              {meta.join(" · ")}
                            </p>
                          </div>
                          {mine && goalCount > 0 && (
                            <span className="flex items-center gap-2">
                              <span
                                className="h-1.5 w-16 overflow-hidden rounded-full bg-raised"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={goalCount}
                                aria-valuenow={myDone}
                                aria-label="Your progress"
                              >
                                <span
                                  className="block h-full rounded-full bg-primary transition-[width] duration-200 ease-mac"
                                  style={{
                                    width: `${goalCount ? (myDone / goalCount) * 100 : 0}%`,
                                  }}
                                />
                              </span>
                              <span className="font-mono text-xs text-muted">
                                {myDone}/{goalCount}
                              </span>
                            </span>
                          )}
                          {mine && goalCount === 0 && (
                            <Badge tone="green">for you</Badge>
                          )}
                          <span className="flex items-center gap-1 text-xs text-faint">
                            <Users className="size-3.5" aria-hidden />
                            {participantCount}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
