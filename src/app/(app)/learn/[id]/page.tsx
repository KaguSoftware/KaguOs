import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Link2, Pencil } from "lucide-react";
import { requireSection } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { SignedFileLink } from "@/components/ui/signed-file-link";
import { SprintProgress } from "@/components/learn/sprint-progress";
import { SprintQuestions } from "@/components/learn/sprint-questions";
import { memberColorCss } from "@/lib/colors";
import { demoName } from "@/lib/data/members";
import { formatDate, todayInIstanbul } from "@/lib/utils";
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
  const today = todayInIstanbul();
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
    // Gate the sprint on the demo/real split — a real sprint id is notFound in
    // showcase, so its real resources/goals/questions/files never render in a
    // client demo. Child tables carry the same filter as defence in depth.
    ctx.supabase
      .from("sprints")
      .select("*")
      .eq("id", id)
      .eq("is_demo", ctx.showcase)
      .maybeSingle(),
    ctx.supabase
      .from("sprint_resources")
      .select("*")
      .eq("sprint_id", id)
      .eq("is_demo", ctx.showcase)
      .order("created_at"),
    ctx.supabase
      .from("sprint_participants")
      .select("user_id")
      .eq("sprint_id", id)
      .eq("is_demo", ctx.showcase),
    ctx.supabase
      .from("sprint_goals")
      .select("*")
      .eq("sprint_id", id)
      .eq("is_demo", ctx.showcase)
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
      .eq("is_demo", ctx.showcase)
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
      // In showcase, the learn roster is anonymized just like the app-wide
      // members map — real names/emails must not reach a client demo.
      return profile
        ? {
            id: profile.id,
            name: ctx.showcase
              ? demoName(profile.id)
              : profile.full_name || profile.email,
            color: memberColorCss(profile.id, profile.color),
          }
        : null;
    })
    .filter((p): p is { id: string; name: string; color: string } => p !== null);

  const participantIds = (participants ?? []).map((p) => p.user_id);
  const gridPeople = people.filter((p) => participantIds.includes(p.id));

  // Attachments are NOT signed here. They used to be — one batched
  // createSignedUrls call with a 1-hour TTL, baked into the markup — and that
  // was a bug: the page outlives its own tokens (router cache, a tab left open,
  // a back-navigation), so clicking a PDF an hour later hit an expired token and
  // looked like a dead button. `SignedFileLink` signs at click instead, which
  // also takes the signing round-trip off this page's critical path entirely.
  const resourceList = (resources ?? []) as SprintResource[];

  const phase = phaseOf(sprint as Sprint);

  // Timeline: where in the sprint are we? Dates are inclusive on both ends.
  const today = todayInIstanbul();
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
                const filePath = resource.file_path;
                const Icon = resource.url ? Link2 : FileText;
                return (
                  <li
                    key={resource.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-raised/60"
                  >
                    <Icon className="size-3.5 shrink-0 text-faint" aria-hidden />
                    {resource.url ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 truncate text-ink underline-offset-2 hover:text-primary-dim hover:underline"
                      >
                        {resource.title}
                      </a>
                    ) : filePath ? (
                      // An attachment with no external link: the title itself
                      // opens the file, signed on click.
                      <SignedFileLink
                        bucket="learn"
                        path={filePath}
                        title={resource.title}
                        className="flex min-w-0 items-center gap-1.5 truncate text-left text-ink underline-offset-2 hover:text-primary-dim hover:underline"
                      >
                        <span className="min-w-0 truncate">{resource.title}</span>
                      </SignedFileLink>
                    ) : (
                      <span className="min-w-0 truncate text-muted">
                        {resource.title}
                      </span>
                    )}
                    {/* A resource can be both a link and an attachment; the chip
                        is the second affordance for the file. */}
                    {resource.url && filePath && (
                      <SignedFileLink
                        bucket="learn"
                        path={filePath}
                        ariaLabel={`Open the file attached to ${resource.title}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-muted transition-colors duration-150 hover:border-line-strong hover:text-ink"
                      >
                        <FileText className="size-3" aria-hidden />
                        file
                      </SignedFileLink>
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
