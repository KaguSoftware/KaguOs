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

  const { data: sprints } = await ctx.supabase
    .from("sprints")
    .select(
      "id, title, description, starts_on, ends_on, sprint_participants(user_id), sprint_goals(count)"
    )
    .order("starts_on", { ascending: false });

  const rows = (sprints ?? []) as SprintRow[];

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
                        {` · ${sprint.sprint_goals[0]?.count ?? 0} goals`}
                      </p>
                    </div>
                    {mine && <Badge tone="green">for you</Badge>}
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
