import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Plus, Users } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Learn" };

type SprintRow = {
  id: string;
  title: string;
  description: string | null;
  starts_on: string;
  ends_on: string;
  sprint_participants: { user_id: string }[];
  sprint_goals: { count: number }[];
};

function phase(sprint: SprintRow): { label: string; tone: BadgeTone } {
  const today = new Date().toISOString().slice(0, 10);
  if (today < sprint.starts_on) return { label: "upcoming", tone: "info" };
  if (today > sprint.ends_on) return { label: "past", tone: "faint" };
  return { label: "active", tone: "green" };
}

export default async function LearnPage() {
  const ctx = await requireSection("learn");

  const [{ data: sprints }, { data: myProgress }] = await Promise.all([
    ctx.supabase
      .from("sprints")
      .select(
        "id, title, description, starts_on, ends_on, sprint_participants(user_id), sprint_goals(count)"
      )
      .order("starts_on", { ascending: false }),
    ctx.supabase
      .from("sprint_goal_progress")
      .select("goal_id, sprint_goals!inner(sprint_id)")
      .eq("user_id", ctx.userId),
  ]);

  const myDoneBySprint = new Map<string, number>();
  for (const row of myProgress ?? []) {
    const sprintId = (row.sprint_goals as unknown as { sprint_id: string }).sprint_id;
    myDoneBySprint.set(sprintId, (myDoneBySprint.get(sprintId) ?? 0) + 1);
  }

  const phaseOrder = { active: 0, upcoming: 1, past: 2 } as const;
  const rows = ((sprints ?? []) as SprintRow[]).sort(
    (a, b) =>
      phaseOrder[phase(a).label as keyof typeof phaseOrder] -
        phaseOrder[phase(b).label as keyof typeof phaseOrder] ||
      (a.starts_on < b.starts_on ? 1 : -1)
  );

  return (
    <>
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
        {rows.length === 0 ? (
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
          <ul className="divide-y divide-line">
            {rows.map((sprint) => {
              const p = phase(sprint);
              const mine = sprint.sprint_participants.some(
                (sp) => sp.user_id === ctx.userId
              );
              const goalCount = sprint.sprint_goals[0]?.count ?? 0;
              const myDone = myDoneBySprint.get(sprint.id) ?? 0;
              return (
                <li key={sprint.id}>
                  <Link
                    href={`/learn/${sprint.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-raised/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{sprint.title}</p>
                      <p className="mt-0.5 text-xs text-faint">
                        {formatDate(sprint.starts_on)} → {formatDate(sprint.ends_on)}
                        {` · ${goalCount} goals`}
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
                            style={{ width: `${goalCount ? (myDone / goalCount) * 100 : 0}%` }}
                          />
                        </span>
                        <span className="font-mono text-xs text-muted">
                          {myDone}/{goalCount}
                        </span>
                      </span>
                    )}
                    {mine && goalCount === 0 && <Badge tone="green">for you</Badge>}
                    <span className="flex items-center gap-1 text-xs text-faint">
                      <Users className="size-3.5" aria-hidden />
                      {sprint.sprint_participants.length}
                    </span>
                    <Badge tone={p.tone}>{p.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
