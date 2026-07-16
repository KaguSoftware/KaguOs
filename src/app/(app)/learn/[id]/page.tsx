import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Link2 } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ProgressGrid } from "@/components/learn/progress-grid";
import { MyGoals } from "@/components/learn/my-goals";
import {
  DeleteSprintButton,
  EditSprintForm,
  GoalsEditor,
  ParticipantsEditor,
  ResourcesEditor,
} from "@/components/learn/sprint-forms";
import { memberColorCss } from "@/lib/colors";
import { formatDate } from "@/lib/utils";
import type { Sprint, SprintGoal, SprintResource } from "@/lib/types";

export const metadata: Metadata = { title: "Sprint" };

function phaseOf(sprint: Sprint): { label: string; tone: BadgeTone } {
  const today = new Date().toISOString().slice(0, 10);
  if (today < sprint.starts_on) return { label: "upcoming", tone: "info" };
  if (today > sprint.ends_on) return { label: "past", tone: "faint" };
  return { label: "active", tone: "green" };
}

export default async function SprintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSection("learn");

  const [
    { data: sprint },
    { data: resources },
    { data: participants },
    { data: goals },
    { data: learnMembers },
  ] = await Promise.all([
    ctx.supabase.from("sprints").select("*").eq("id", id).maybeSingle(),
    ctx.supabase
      .from("sprint_resources")
      .select("*")
      .eq("sprint_id", id)
      .order("created_at"),
    ctx.supabase.from("sprint_participants").select("user_id").eq("sprint_id", id),
    ctx.supabase
      .from("sprint_goals")
      .select("*")
      .eq("sprint_id", id)
      .order("sort_order")
      .order("created_at"),
    ctx.supabase
      .from("section_memberships")
      .select("user_id, profiles(id, full_name, email, color)")
      .eq("section", "learn"),
  ]);
  if (!sprint) notFound();

  const goalIds = (goals ?? []).map((g) => g.id);
  const { data: progress } = goalIds.length
    ? await ctx.supabase
        .from("sprint_goal_progress")
        .select("goal_id, user_id")
        .in("goal_id", goalIds)
    : { data: [] };

  const people = (learnMembers ?? [])
    .map((m) => {
      const profile = m.profiles as unknown as {
        id: string;
        full_name: string | null;
        email: string;
        color: string | null;
      } | null;
      return profile
        ? {
            id: profile.id,
            name: profile.full_name || profile.email,
            color: memberColorCss(profile.id, profile.color),
          }
        : null;
    })
    .filter((p): p is { id: string; name: string; color: string } => p !== null);

  const participantIds = (participants ?? []).map((p) => p.user_id);
  const gridPeople = people.filter((p) => participantIds.includes(p.id));
  const iParticipate = participantIds.includes(ctx.userId);
  const myDoneGoalIds = (progress ?? [])
    .filter((p) => p.user_id === ctx.userId)
    .map((p) => p.goal_id);

  // Signed URLs for uploaded files (private bucket, 1 hour).
  const resourceList = (resources ?? []) as SprintResource[];
  const fileUrls = new Map<string, string>();
  for (const resource of resourceList) {
    if (!resource.file_path) continue;
    const { data: signed } = await ctx.supabase.storage
      .from("learn")
      .createSignedUrl(resource.file_path, 3600);
    if (signed?.signedUrl) fileUrls.set(resource.id, signed.signedUrl);
  }

  const phase = phaseOf(sprint as Sprint);

  return (
    <>
      <Link
        href="/learn"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All sprints
      </Link>
      <PageHeader
        title={sprint.title}
        description={`${formatDate(sprint.starts_on)} → ${formatDate(sprint.ends_on)}`}
        action={<Badge tone={phase.tone}>{phase.label}</Badge>}
      />

      {sprint.description && (
        <p className="mb-6 max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-muted">
          {sprint.description}
        </p>
      )}

      <div className="grid gap-6">
        {resourceList.length > 0 && (
          <Panel>
            <PanelHeader title="Resources" />
            <ul className="space-y-1.5 p-4">
              {resourceList.map((resource) => {
                const fileUrl = fileUrls.get(resource.id);
                return (
                  <li key={resource.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-muted underline-offset-2 hover:text-ink hover:underline"
                      >
                        <Link2 className="size-3.5 shrink-0 text-faint" aria-hidden />
                        {resource.title}
                      </a>
                    )}
                    {fileUrl && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-muted underline-offset-2 hover:text-ink hover:underline"
                      >
                        <FileText className="size-3.5 shrink-0 text-faint" aria-hidden />
                        {resource.url ? "attached file" : resource.title}
                      </a>
                    )}
                    {!resource.url && !fileUrl && (
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <FileText className="size-3.5 shrink-0 text-faint" aria-hidden />
                        {resource.title}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {iParticipate && goals && goals.length > 0 && (
          <Panel>
            <PanelHeader
              title="Your goals"
              action={
                <span className="font-mono text-xs text-muted">
                  {myDoneGoalIds.length}/{goals.length} done
                </span>
              }
            />
            <MyGoals
              sprintId={sprint.id}
              goals={(goals ?? []) as SprintGoal[]}
              doneGoalIds={myDoneGoalIds}
            />
          </Panel>
        )}

        <Panel>
          <PanelHeader
            title={`Team progress (${gridPeople.length} ${gridPeople.length === 1 ? "person" : "people"})`}
          />
          {goals && goals.length > 0 && gridPeople.length > 0 ? (
            <ProgressGrid
              sprintId={sprint.id}
              goals={(goals ?? []) as SprintGoal[]}
              participants={gridPeople}
              progress={progress ?? []}
              meId={ctx.userId}
            />
          ) : (
            <p className="p-4 text-[13px] text-faint">
              {ctx.isAdmin
                ? "Add goals and participants below to start tracking."
                : "Goals and participants haven't been set up yet."}
            </p>
          )}
        </Panel>

        {ctx.isAdmin && (
          <>
            <Panel>
              <PanelHeader title="Sprint settings" />
              <EditSprintForm sprint={sprint as Sprint} />
            </Panel>
            <Panel>
              <PanelHeader title="Participants" />
              <ParticipantsEditor
                sprintId={sprint.id}
                people={people}
                current={participantIds}
              />
            </Panel>
            <Panel>
              <PanelHeader title="Goals" />
              <GoalsEditor sprintId={sprint.id} goals={(goals ?? []) as SprintGoal[]} />
            </Panel>
            <Panel>
              <PanelHeader title="Resources" />
              <ResourcesEditor sprintId={sprint.id} resources={resourceList} />
            </Panel>
            <DeleteSprintButton sprintId={sprint.id} />
          </>
        )}
      </div>
    </>
  );
}
