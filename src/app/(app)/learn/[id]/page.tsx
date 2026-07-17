import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Link2, Pencil } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { SprintProgress } from "@/components/learn/sprint-progress";
import { SprintQuestions } from "@/components/learn/sprint-questions";
import { memberColorCss } from "@/lib/colors";
import { formatDate } from "@/lib/utils";
import type {
  Sprint,
  SprintGoal,
  SprintQuestion,
  SprintQuestionReply,
  SprintResource,
} from "@/lib/types";

export const metadata: Metadata = { title: "Sprint" };

const DAY_MS = 24 * 60 * 60 * 1000;

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
    { data: questions },
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
    ctx.supabase
      .from("sprint_questions")
      .select("*")
      .eq("sprint_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!sprint) notFound();

  // Second wave: both reads depend on ids from the first (goal ids, question
  // ids) — still ONE wave, per the perf doctrine.
  const goalIds = (goals ?? []).map((g) => g.id);
  const questionIds = (questions ?? []).map((q) => q.id);
  const [{ data: progress }, { data: replies }] = await Promise.all([
    goalIds.length
      ? ctx.supabase
          .from("sprint_goal_progress")
          .select("goal_id, user_id")
          .in("goal_id", goalIds)
      : Promise.resolve({ data: [] }),
    questionIds.length
      ? ctx.supabase
          .from("sprint_question_replies")
          .select("*")
          .in("question_id", questionIds)
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);

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

  // Signed URLs for uploaded files (private bucket, 1 hour).
  //
  // ONE call for every file, not one call per file. Signing in a loop cost a
  // full round-trip each time (~305ms), serially — a sprint with six attachments
  // spent ~1.8s doing nothing but waiting, and it got worse every time someone
  // uploaded another file. createSignedUrls (plural) signs the whole batch in a
  // single trip, so the cost is flat no matter how many resources a sprint has.
  const resourceList = (resources ?? []) as SprintResource[];
  const withFiles = resourceList.filter((r) => r.file_path);
  const fileUrls = new Map<string, string>();
  if (withFiles.length > 0) {
    const { data: signed } = await ctx.supabase.storage
      .from("learn")
      .createSignedUrls(
        withFiles.map((r) => r.file_path as string),
        3600
      );
    // Match on path rather than index — the response order isn't guaranteed,
    // and a single unsignable file returns a row with its own error, not a throw.
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const resource of withFiles) {
      const url = byPath.get(resource.file_path as string);
      if (url) fileUrls.set(resource.id, url);
    }
  }

  const phase = phaseOf(sprint as Sprint);

  // Timeline: where in the sprint are we? Dates are inclusive on both ends.
  const today = new Date().toISOString().slice(0, 10);
  const totalDays =
    Math.round((Date.parse(sprint.ends_on) - Date.parse(sprint.starts_on)) / DAY_MS) + 1;
  const dayOf = Math.min(
    totalDays,
    Math.max(1, Math.round((Date.parse(today) - Date.parse(sprint.starts_on)) / DAY_MS) + 1)
  );
  const daysUntil = Math.round((Date.parse(sprint.starts_on) - Date.parse(today)) / DAY_MS);
  const timeline =
    phase.label === "active"
      ? `day ${dayOf} of ${totalDays}`
      : phase.label === "upcoming"
        ? daysUntil === 1
          ? "starts tomorrow"
          : `starts in ${daysUntil} days`
        : null;

  // Team completion across every participant and goal, from rows already fetched.
  const totalCells = (goals?.length ?? 0) * gridPeople.length;
  const participantSet = new Set(participantIds);
  const doneCells = (progress ?? []).filter((p) => participantSet.has(p.user_id)).length;
  const teamPct = totalCells > 0 ? Math.round((doneCells / totalCells) * 100) : null;

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
        action={
          <span className="flex items-center gap-2">
            <Badge tone={phase.tone}>{phase.label}</Badge>
            {ctx.isAdmin && (
              <LinkButton href={`/learn/${id}/edit`} variant="outline">
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </LinkButton>
            )}
          </span>
        }
      />

      {(timeline || teamPct !== null) && (
        <div className="mb-6 max-w-md">
          <p className="flex items-center gap-3 font-mono text-xs text-faint">
            {timeline && <span>{timeline}</span>}
            {phase.label === "active" && timeline && teamPct !== null && (
              <span aria-hidden>·</span>
            )}
            {teamPct !== null && <span>team {teamPct}% done</span>}
          </p>
          {phase.label === "active" && totalDays > 1 && (
            <span
              className="mt-2 block h-1 overflow-hidden rounded-full bg-raised"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={totalDays}
              aria-valuenow={dayOf}
              aria-label={`Day ${dayOf} of ${totalDays}`}
            >
              <span
                className="block h-full rounded-full bg-primary/60"
                style={{ width: `${(dayOf / totalDays) * 100}%` }}
              />
            </span>
          )}
        </div>
      )}

      {sprint.description && (
        <p className="mb-6 max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-muted">
          {sprint.description}
        </p>
      )}

      <div className="grid gap-6">
        {resourceList.length > 0 && (
          <Panel>
            <PanelHeader title="Resources" />
            <ul className="divide-y divide-line">
              {resourceList.map((resource) => {
                const fileUrl = fileUrls.get(resource.id);
                const primaryHref = resource.url || fileUrl;
                const Icon = resource.url ? Link2 : FileText;
                return (
                  <li
                    key={resource.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-raised/60"
                  >
                    <Icon className="size-3.5 shrink-0 text-faint" aria-hidden />
                    {primaryHref ? (
                      <a
                        href={primaryHref}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 truncate text-ink underline-offset-2 hover:text-primary-dim hover:underline"
                      >
                        {resource.title}
                      </a>
                    ) : (
                      <span className="min-w-0 truncate text-muted">
                        {resource.title}
                      </span>
                    )}
                    {resource.url && fileUrl && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-muted transition-colors duration-150 hover:border-line-strong hover:text-ink"
                      >
                        <FileText className="size-3" aria-hidden />
                        file
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        <SprintProgress
          sprintId={sprint.id}
          goals={(goals ?? []) as SprintGoal[]}
          participants={gridPeople}
          progress={progress ?? []}
          meId={ctx.userId}
          isAdmin={ctx.isAdmin}
        />

        <Panel>
          <PanelHeader
            title="Questions"
            action={
              (questions ?? []).length > 0 ? (
                <span className="font-mono text-xs text-muted">
                  {(questions ?? []).length}
                </span>
              ) : undefined
            }
          />
          <SprintQuestions
            sprintId={sprint.id}
            questions={(questions ?? []) as SprintQuestion[]}
            replies={(replies ?? []) as SprintQuestionReply[]}
            people={people}
            meId={ctx.userId}
            isAdmin={ctx.isAdmin}
          />
        </Panel>
      </div>
    </>
  );
}
