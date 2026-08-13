import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { canWrite, requireSection } from "@/lib/data/session";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { SprintProgress } from "@/components/learn/sprint-progress";
import { SprintQuestions } from "@/components/learn/sprint-questions";
import { ProofReview } from "@/components/learn/proof-review";
import { JoinSprintButton } from "@/components/learn/join-sprint-button";
import { ProgramStatsRow } from "@/components/learn/program-stats";
import { ProgramMethod } from "@/components/learn/program-method";
import { memberColorCss } from "@/lib/colors";
import { demoName } from "@/lib/data/members";
import { programStats } from "@/lib/learn";
import { formatDate, todayInIstanbul } from "@/lib/utils";
import type {
  Sprint,
  SprintGoal,
  SprintPractice,
  SprintProofCriterion,
  SprintProofSubmission,
  SprintQuestion,
  SprintQuestionReply,
  SprintResource,
  SprintStage,
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
    resources,
    participants,
    goals,
    learnMembers,
    questions,
    stages,
    practices,
  ] = await Promise.all([
    // Gate the sprint on the demo/real split — a real sprint id is notFound in
    // showcase, so its real resources/goals/questions/files never render in a
    // client demo. Child tables carry the same filter as defence in depth.
    selectOrThrow(
      ctx.supabase
        .from("sprints")
        .select("*")
        .eq("id", id)
        .eq("is_demo", ctx.showcase)
        .maybeSingle(),
      "sprint"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("sprint_resources")
        .select("*")
        .eq("sprint_id", id)
        .eq("is_demo", ctx.showcase)
        .order("sort_order")
        .order("created_at"),
      "sprint_resources"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("sprint_participants")
        .select("user_id")
        .eq("sprint_id", id)
        .eq("is_demo", ctx.showcase),
      "sprint_participants"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("sprint_goals")
        .select("*")
        .eq("sprint_id", id)
        .eq("is_demo", ctx.showcase)
        .order("sort_order")
        .order("created_at"),
      "sprint_goals"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("section_memberships")
        .select("user_id, profiles(id, full_name, email, color)")
        .eq("section", "learn"),
      "section_memberships"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("sprint_questions")
        .select("*")
        .eq("sprint_id", id)
        .eq("is_demo", ctx.showcase)
        .order("created_at", { ascending: false }),
      "sprint_questions"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("sprint_stages")
        .select("*")
        .eq("sprint_id", id)
        .eq("is_demo", ctx.showcase)
        .order("sort_order")
        .order("created_at"),
      "sprint_stages"
    ),
    rowsOrThrow(
      ctx.supabase
        .from("sprint_practices")
        .select("*")
        .eq("sprint_id", id)
        .eq("is_demo", ctx.showcase)
        .order("sort_order")
        .order("created_at"),
      "sprint_practices"
    ),
  ]);
  if (!sprint) notFound();

  // Second wave: every read here depends on ids from the first (goal, resource,
  // question and stage ids) — still ONE wave, per the perf doctrine.
  const goalIds = goals.map((g) => g.id);
  const resourceIds = resources.map((r) => r.id);
  const questionIds = questions.map((q) => q.id);
  const stageIds = stages.map((s) => s.id);
  const [progress, watched, replies, criteria, submissions] = await Promise.all([
    goalIds.length
      ? rowsOrThrow(
          ctx.supabase
            .from("sprint_goal_progress")
            .select("goal_id, user_id")
            .in("goal_id", goalIds),
          "sprint_goal_progress"
        )
      : Promise.resolve([]),
    // Only mine: a watched video is a private note-to-self, not a standing. The
    // race is run on goals, so nobody needs everyone else's watch list.
    resourceIds.length
      ? rowsOrThrow(
          ctx.supabase
            .from("sprint_resource_progress")
            .select("resource_id")
            .in("resource_id", resourceIds)
            .eq("user_id", ctx.userId),
          "sprint_resource_progress"
        )
      : Promise.resolve([]),
    questionIds.length
      ? rowsOrThrow(
          ctx.supabase
            .from("sprint_question_replies")
            .select("*")
            .in("question_id", questionIds)
            .order("created_at"),
          "sprint_question_replies"
        )
      : Promise.resolve([]),
    // The conditions each stage's hand-in is read against.
    stageIds.length
      ? rowsOrThrow(
          ctx.supabase
            .from("sprint_proof_criteria")
            .select("*")
            .in("stage_id", stageIds)
            .eq("is_demo", ctx.showcase)
            .order("sort_order")
            .order("created_at"),
          "sprint_proof_criteria"
        )
      : Promise.resolve([]),
    // Hand-ins. No user filter: RLS returns mine, or everyone's to an admin
    // (0061), which is exactly the split the two panels below want — so the
    // reviewer's queue costs no extra query.
    rowsOrThrow(
      ctx.supabase
        .from("sprint_proof_submissions")
        .select("*")
        .eq("sprint_id", id)
        .eq("is_demo", ctx.showcase)
        .order("updated_at", { ascending: false }),
      "sprint_proof_submissions"
    ),
  ]);

  const people = learnMembers
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

  const participantIds = participants.map((p) => p.user_id);
  const gridPeople = people.filter((p) => participantIds.includes(p.id));

  // Attachments are NOT signed here. They used to be — one batched
  // createSignedUrls call with a 1-hour TTL, baked into the markup — and that
  // was a bug: the page outlives its own tokens (router cache, a tab left open,
  // a back-navigation), so clicking a PDF an hour later hit an expired token and
  // looked like a dead button. `SignedFileLink` signs at click instead, which
  // also takes the signing round-trip off this page's critical path entirely.
  const stageList = stages as SprintStage[];
  // One read, two audiences (0061): RLS hands an admin every hand-in and
  // everyone else only their own, so the reviewer's queue and "my proof" are
  // slices of the same rows rather than a second query.
  const allProof = submissions as SprintProofSubmission[];
  const myProof = allProof.filter((s) => s.user_id === ctx.userId);
  const waiting = allProof.filter((s) => s.status === "submitted").length;
  const practiceList = practices as SprintPractice[];
  const rules = practiceList.filter((p) => p.kind === "rule");
  const session = practiceList.filter((p) => p.kind === "session");
  const build = practiceList.filter((p) => p.kind === "build");

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
  const totalCells = goals.length * gridPeople.length;
  const participantSet = new Set(participantIds);
  const doneCells = progress.filter((p) => participantSet.has(p.user_id)).length;
  const teamPct = totalCells > 0 ? Math.round((doneCells / totalCells) * 100) : null;

  // View-only members read the sprint but can't tick or enroll (0053).
  const mayWrite = canWrite(ctx, "learn");
  const iParticipate = participantSet.has(ctx.userId);
  const canJoin =
    !iParticipate && sprint.join_mode === "open" && phase.label !== "past";
  const stats = programStats(stageList, totalDays);

  // The title block is handed to SprintProgress rather than rendered here: the
  // milestone bar sticks to the top of the page and reads live ticks, so it has
  // to be the first thing that component renders, with this underneath it.
  const header = (
    <div className="[&>*:last-child]:mb-0">
      <Link
        href="/learn"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All sprints
      </Link>
      <PageHeader
        title={sprint.title}
        description={
          sprint.tagline ??
          `${formatDate(sprint.starts_on)} → ${formatDate(sprint.ends_on)}`
        }
        action={
          <span className="flex items-center gap-2">
            <Badge tone={phase.tone}>{phase.label}</Badge>
            {mayWrite && (canJoin || (iParticipate && sprint.join_mode === "open")) && (
              <JoinSprintButton
                sprintId={sprint.id}
                joined={iParticipate}
                canLeave={phase.label === "upcoming"}
              />
            )}
            {ctx.isAdmin && (
              <LinkButton href={`/learn/${id}/edit`} variant="outline">
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </LinkButton>
            )}
          </span>
        }
      />

      {(sprint.tagline || timeline || teamPct !== null) && (
        <div className="mb-6 max-w-md">
          <p className="flex flex-wrap items-center gap-x-3 font-mono text-xs text-faint">
            {sprint.tagline && (
              <>
                <span>
                  {formatDate(sprint.starts_on)} → {formatDate(sprint.ends_on)}
                </span>
                <span aria-hidden>·</span>
              </>
            )}
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

      {stageList.length > 0 && (
        <div className="mb-6">
          <ProgramStatsRow stats={stats} />
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-6">
      <SprintProgress
        header={header}
        sprintId={sprint.id}
        stages={stageList}
        goals={goals as SprintGoal[]}
        resources={resources as SprintResource[]}
        criteria={criteria as SprintProofCriterion[]}
        myProof={myProof}
        build={build}
        participants={gridPeople}
        progress={progress}
        watched={watched as { resource_id: string }[]}
        meId={ctx.userId}
        isAdmin={ctx.isAdmin}
        mayWrite={mayWrite}
        method={
          rules.length > 0 || session.length > 0 ? (
            <Panel>
              {/* Header lives inside — it's the disclosure toggle. */}
              <ProgramMethod rules={rules} session={session} />
            </Panel>
          ) : undefined
        }
      />

      {sprint.outro && (
        <p className="max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-muted">
          {sprint.outro}
        </p>
      )}

      {/* The reviewer's queue. Admins only — RLS already made `allProof`
          everyone's for them and mine for everyone else, so this panel can't
          render someone else's proof to a person who shouldn't see it. */}
      {ctx.isAdmin && (
        <Panel>
          <PanelHeader
            title="Proof hand-ins"
            action={
              waiting > 0 ? (
                <span className="font-mono text-xs tabular-nums text-amber">
                  {waiting} waiting
                </span>
              ) : allProof.length > 0 ? (
                <span className="font-mono text-xs tabular-nums text-muted">
                  {allProof.length}
                </span>
              ) : undefined
            }
          />
          <ProofReview
            sprintId={sprint.id}
            submissions={allProof}
            stages={stageList}
            people={people}
          />
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Questions"
          action={
            questions.length > 0 ? (
              <span className="font-mono text-xs text-muted">
                {questions.length}
              </span>
            ) : undefined
          }
        />
        <SprintQuestions
          sprintId={sprint.id}
          questions={questions as SprintQuestion[]}
          replies={replies as SprintQuestionReply[]}
          people={people}
          meId={ctx.userId}
          isAdmin={ctx.isAdmin}
        />
    </Panel>
    </div>
  );
}
