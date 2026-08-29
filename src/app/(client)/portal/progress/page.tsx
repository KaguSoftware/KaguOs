import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Building2,
  ExternalLink,
  Route,
  TriangleAlert,
} from "lucide-react";
import {
  loadPortal,
  milestoneProgress,
  type MilestoneProgress,
} from "@/lib/data/portal";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Panel } from "@/components/ui/panel";
import { ProgressMeter } from "@/components/portal/progress-meter";
import {
  BusinessHeading,
  MilestoneBadge,
  MilestoneDot,
} from "@/components/portal/bits";
import { PortalLinks, portalLinkRows } from "@/components/portal/links";
import {
  SystemColumns,
  type StepView,
  type SystemView,
} from "@/components/portal/system-columns";
import { dict, milestoneStatusLabel, type PortalDict } from "@/lib/i18n";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/lib/locale";
import { milestoneTree, type ProjectMilestone } from "@/lib/types";
import { cn, formatDateIn, isolate, todayInIstanbul } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: dict(locale).navProgress };
}

/**
 * Where the build is.
 *
 * ── Two bars, and why both belong on one page ──────────────────────────────
 *
 * A client asking "how's it going?" is really asking two questions, and only
 * one of them is about Kagu. The milestones say what we have built; the input
 * pack says what we are still waiting on THEM for. Splitting those across two
 * screens lets each side believe the delay belongs to the other, which is
 * exactly the conversation this page exists to prevent — so the pack's meter
 * sits next to the build's, on the same row, for every business.
 *
 * ── Why blocked milestones are hoisted ─────────────────────────────────────
 *
 * A blockage is the single most expensive thing to find out late, and it is
 * almost always waiting on the client. It is pulled to the top of the business
 * rather than left in date order down the list, where it would read as one
 * quiet row among nine.
 *
 * ── Why the links sit above the plan ───────────────────────────────────────
 *
 * Because "how's it going?" has a better answer than a percentage, and it is
 * the staging site (0082). A client who can open the thing and click around it
 * does not need to be told 62% first, and one who scrolled past four columns to
 * find the address has already had the worse version of this page. The bars
 * stay — they are what the link cannot show, namely what is NOT there yet.
 *
 * ── Two shapes of plan, two views ──────────────────────────────────────────
 *
 * A plan whose top-level phases are the SYSTEMS being delivered, each with
 * its own steps (0080: mobile app, desktop app, website, management panel), is
 * shown as one column per system — the reader's question is "how far is my
 * app?", and a column with a bar answers it in one glance. Any other plan — a
 * flat list, a sequence of weeks, phases without steps — keeps the rail, which
 * is the right shape for "what comes next". `columnar()` is the test.
 *
 * ── Language ───────────────────────────────────────────────────────────────
 *
 * Every word the page says in its own voice comes from `dict(locale)`, the
 * dashboard's rule. The plan's titles and detail are the producer's text and
 * arrive in whatever language they were written; the chrome around them must
 * not be the thing that makes an Arabic page read as English.
 *
 * Which is also why every one of those producer-written runs is rendered with
 * `dir="auto"` (or inside a `<bdi>`, which is the same thing plus isolation),
 * and why a date handed to a dictionary function goes through `isolate()`
 * first: an English title or a Latin date is a left-to-right island in a
 * right-to-left paragraph, and the neutral characters touching it — a dash, a
 * middot, a bracket — otherwise drift to the wrong end of the line.
 */
export default async function PortalProgressPage() {
  const portal = await loadPortal();
  const today = todayInIstanbul();
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = dict(locale);

  return (
    <>
      <LiveRefresh
        tables={[
          "project_milestones",
          "project_links",
          "project_intake",
          "project_intake_answers",
        ]}
      />

      <PageHeader title={t.navProgress} description={t.progressDescription} />

      {portal.projects.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={Building2}
            title={t.nothingSharedTitle}
            hint={t.nothingSharedHint}
          />
        </div>
      ) : (
        <div className="grid gap-10">
          {portal.projects.map((project) => {
            const milestones = portal.milestonesByProject.get(project.id) ?? [];
            const build = milestoneProgress(milestones);
            const tree = milestoneTree(milestones);
            const systems = columnar(tree)
              ? toSystems(tree, build, t, locale, today)
              : null;
            const intake = portal.intake.get(project.id);
            const packPct = intake?.progress.pct ?? 0;
            const packSent = Boolean(intake?.submittedAt);
            // What they can go and open. RLS has already dropped the
            // unpublished ones (0082 §3), so anything here is deliberate.
            const linkRows = portalLinkRows(
              portal.linksByProject.get(project.id) ?? [],
              milestones
            );

            // For a columnar plan the honest count is steps, not systems —
            // "0/4 done" while three systems are half-built says nothing.
            const stepTotal = systems
              ? systems.reduce((n, s) => n + s.steps.length, 0)
              : 0;
            const stepDone = systems
              ? systems.reduce(
                  (n, s) => n + s.steps.filter((step) => step.status === "done").length,
                  0
                )
              : 0;

            return (
              <section key={project.id}>
                <BusinessHeading
                  name={project.name}
                  action={
                    systems ? (
                      <span className="font-mono text-xs tabular-nums text-faint rtl:font-sans">
                        {t.stepsDone(stepDone, stepTotal)}
                      </span>
                    ) : build.total > 0 ? (
                      <span className="font-mono text-xs tabular-nums text-faint rtl:font-sans">
                        {t.phasesDone(build.done, build.total)}
                      </span>
                    ) : undefined
                  }
                />

                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  <Panel className="p-4">
                    <p className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint rtl:font-sans rtl:normal-case rtl:tracking-normal">
                      {t.build}
                    </p>
                    <p className="mt-1.5 text-[calc(19px*var(--text-scale,1))] font-medium tabular-nums text-ink">
                      {t.percent(build.pct)}
                    </p>
                    <ProgressMeter
                      className="mt-2"
                      pct={build.pct}
                      done={systems ? stepDone : build.done}
                      total={systems ? stepTotal : build.total}
                      label={t.buildProgressAria(project.name)}
                    />
                    <p className="mt-2 text-[calc(12px*var(--text-scale,1))] text-faint">
                      {build.next
                        ? t.nextIs(isolate(build.next.title))
                        : build.total === 0
                          ? t.planNotShared
                          : t.everythingDone}
                    </p>
                    {build.weighted && !systems && (
                      <p className="mt-1 text-[calc(12px*var(--text-scale,1))] text-faint">
                        {t.weightedNote}
                      </p>
                    )}
                  </Panel>

                  <Panel className="p-4">
                    <p className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint rtl:font-sans rtl:normal-case rtl:tracking-normal">
                      {t.yourInputPack}
                    </p>
                    <p className="mt-1.5 text-[calc(19px*var(--text-scale,1))] font-medium tabular-nums text-ink">
                      {t.percent(packPct)}
                    </p>
                    <ProgressMeter
                      className="mt-2"
                      pct={packPct}
                      done={intake?.progress.done ?? 0}
                      total={intake?.progress.total ?? 0}
                      label={t.packProgressAria(project.name)}
                    />
                    <p className="mt-2 text-[calc(12px*var(--text-scale,1))]">
                      {packSent ? (
                        <span className="text-primary-dim">{t.sentThankYou}</span>
                      ) : (
                        <Link
                          href={`/portal/inputs/${project.id}`}
                          className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-ink hover:underline"
                        >
                          {t.carryOn}
                          <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                        </Link>
                      )}
                    </p>
                  </Panel>
                </div>

                {build.blocked.length > 0 && (
                  <div className="mb-5 rounded-md border border-danger/30 bg-danger/5 p-4">
                    <p className="flex items-center gap-2 text-[calc(13px*var(--text-scale,1))] font-medium text-danger">
                      <TriangleAlert className="size-4" aria-hidden />
                      {t.blockedCount(build.blocked.length)}
                    </p>
                    <ul className="mt-2 grid gap-1.5">
                      {build.blocked.map((milestone) => (
                        <li
                          key={milestone.id}
                          className="text-[calc(13px*var(--text-scale,1))] text-muted"
                        >
                          {/* Both halves are staff-typed and usually English
                              inside an Arabic list, and the dash between them is
                              bidi-neutral: glued onto the detail it takes the
                              paragraph direction and jumps to the far end of the
                              line. <bdi> isolates each run and leaves the dash a
                              node of its own, between them. */}
                          <bdi className="text-ink">{milestone.title}</bdi>
                          {milestone.detail && (
                            <>
                              <span aria-hidden> — </span>
                              <bdi>{milestone.detail}</bdi>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ---- The work itself, above the plan that describes it.
                    Somebody who can open the staging site does not need to be
                    told a percentage first, and a reader who scrolled past four
                    columns to find the link has already had the worse version
                    of this page. Only rendered when there IS something to open
                    — an empty "Take a look" is a promise the page can't keep. */}
                {linkRows.length > 0 && (
                  <section className="mb-5">
                    <h3 className="flex items-center gap-2 text-[calc(14px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
                      <ExternalLink className="size-4 text-faint" aria-hidden />
                      {t.takeALook}
                    </h3>
                    <p className="mt-1 max-w-[70ch] text-[calc(12px*var(--text-scale,1))] leading-relaxed text-faint">
                      {t.takeALookBlurb}
                    </p>
                    <PortalLinks className="mt-3" rows={linkRows} t={t} />
                  </section>
                )}

                {milestones.length === 0 ? (
                  <div className="rounded-lg border border-line bg-surface">
                    <EmptyState icon={Route} title={t.noPlanTitle} hint={t.noPlanHint} />
                  </div>
                ) : systems ? (
                  <SystemColumns
                    systems={systems}
                    labels={{
                      systemsAria: t.systemsAria,
                      whatThisIs: t.whatThisIs,
                      stepProgress: t.stepProgress,
                      systemProgress: t.systemProgress,
                      notStartedYet: t.notStartedYet,
                      closeStep: t.closeStep,
                      closeSystem: t.closeSystem,
                      late: t.late,
                    }}
                  />
                ) : (
                  <Timeline
                    milestones={milestones}
                    build={build}
                    t={t}
                    locale={locale}
                    today={today}
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ── The columnar shape ───────────────────────────────────────────────────── */

type Tree = ReturnType<typeof milestoneTree>;

/**
 * Is this plan "systems with steps"?
 *
 * Every top-level phase must have steps — one bare phase among four columns
 * would be a bar with nothing under it — and there must be few enough of them
 * to sit side by side. Six is the most that fits a wide screen at a readable
 * width; beyond that the rail is the better shape anyway.
 */
function columnar(tree: Tree): boolean {
  return (
    tree.length >= 2 &&
    tree.length <= 6 &&
    tree.every((node) => node.steps.length > 0)
  );
}

/**
 * The tree, with every label resolved for the client component.
 *
 * Strings are built here rather than in the component because half the
 * dictionary is functions, which cannot cross to the client. A share label is
 * only produced for a weighted row on a weighted plan — the rail's rule: on an
 * unweighted plan "0% of the build" would be a lie about a phase that counts
 * for a quarter, and a zero-weight row on a weighted plan is "not weighted"
 * (0075 §1c), not "worth nothing".
 */
function toSystems(
  tree: Tree,
  build: MilestoneProgress,
  t: PortalDict,
  locale: Locale,
  today: string
): SystemView[] {
  return tree.map(({ phase, steps }) => {
    const childAllocated = steps.reduce((sum, s) => sum + Number(s.weight ?? 0), 0);
    const done = steps.filter((s) => s.status === "done").length;
    return {
      id: phase.id,
      title: phase.title,
      detail: phase.detail,
      status: phase.status,
      statusLabel: milestoneStatusLabel(t, phase.status),
      pct: pctOf(phase),
      pctLabel: t.percent(pctOf(phase)),
      shareLabel:
        build.weighted && Number(phase.weight) > 0
          ? t.shareOfBuild(trim(phase.weight))
          : null,
      progressAria: t.systemProgressAria(phase.title),
      stepsDoneLabel: t.stepsDone(done, steps.length),
      partOfLabel: t.partOf(phase.title),
      steps: steps.map((step): StepView => {
        const late =
          step.status !== "done" && step.target_on !== null && step.target_on < today;
        return {
          id: step.id,
          title: step.title,
          detail: step.detail,
          status: step.status,
          statusLabel: milestoneStatusLabel(t, step.status),
          pct: pctOf(step),
          pctLabel: t.percent(pctOf(step)),
          shareLabel:
            childAllocated > 0 && Number(step.weight) > 0
              ? t.shareOfSystem(trim(step.weight))
              : null,
          progressAria: t.stepProgressAria(step.title),
          dateLine: step.done_on
            ? t.doneOn(isolate(formatDateIn(locale, step.done_on)))
            : step.target_on
              ? t.targetOn(isolate(formatDateIn(locale, step.target_on)))
              : null,
          late,
        };
      }),
    };
  });
}

/* ── The rail ─────────────────────────────────────────────────────────────── */

/**
 * The plan, in order.
 *
 * A vertical rail rather than a table: milestones are a sequence, the reader is
 * walking down it looking for "where are we now", and the one thing a table
 * cannot show is that the rows are consecutive. The connector stops at the last
 * item — a line that continues past the final step implies there is more of it
 * off-screen.
 */
function Timeline({
  milestones,
  build,
  t,
  locale,
  today,
}: {
  milestones: ProjectMilestone[];
  build: MilestoneProgress;
  t: PortalDict;
  locale: Locale;
  today: string;
}) {
  // Top-level phases carry the rail; their sub-phases are listed inside the
  // item rather than as further rail stops. A client reading this wants five
  // things they can hold in their head, each of which opens up — not twenty-five
  // dots that make the build look like a backlog.
  const tree = milestoneTree(milestones);

  return (
    <ol className="relative grid gap-0">
      {tree.map(({ phase: milestone, steps }, index) => {
        const last = index === tree.length - 1;
        const late =
          milestone.status !== "done" &&
          milestone.target_on !== null &&
          milestone.target_on < today;

        return (
          <li key={milestone.id} className="relative flex gap-3 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <MilestoneDot status={milestone.status} />
              {!last && <span className="mt-1 w-px flex-1 bg-line" aria-hidden />}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <p
                  dir="auto"
                  className={cn(
                    "min-w-0 text-[calc(14px*var(--text-scale,1))] font-medium",
                    milestone.status === "done" ? "text-muted" : "text-ink"
                  )}
                >
                  {milestone.title}
                </p>
                <MilestoneBadge
                  status={milestone.status}
                  label={milestoneStatusLabel(t, milestone.status)}
                />
              </div>

              {milestone.detail && (
                <p
                  dir="auto"
                  className="mt-1 max-w-[70ch] whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted"
                >
                  {milestone.detail}
                </p>
              )}

              {/* How far through THIS phase, and what that is worth overall.
                  Only on the phases where the answer isn't already obvious: a
                  finished phase says "done" above and a bar at 100% under it
                  adds nothing, and an untouched one at 0% draws the eye to a
                  bar that has no news in it. */}
              {build.weighted && milestone.status !== "done" && pctOf(milestone) > 0 && (
                <div className="mt-2 max-w-sm">
                  <ProgressMeter
                    pct={pctOf(milestone)}
                    done={0}
                    total={0}
                    caption={t.percent(pctOf(milestone))}
                    label={t.phaseProgressAria(milestone.title)}
                  />
                </div>
              )}

              {build.weighted && Number(milestone.weight) > 0 && (
                /* Two sentences, two nodes. Built as one string with a " · "
                   between them, the middot is bidi-neutral and welded into the
                   Arabic text node, so it resolves to the paragraph direction
                   and lands at the wrong end of the line with nothing able to
                   reach in and fix it. The gap does the separating instead. */
                <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint rtl:font-sans">
                  <span>{t.ofTheProject(trim(milestone.weight))}</span>
                  {milestone.status !== "done" && (
                    <span>
                      {t.countedSoFar(trim(build.share.get(milestone.id) ?? 0))}
                    </span>
                  )}
                </p>
              )}

              {/* What this phase is made of. Plain rows, not a second rail:
                  the nesting is already carried by the indent and the parent's
                  dot, and a rail inside a rail reads as two plans. */}
              {steps.length > 0 && (
                <ul className="mt-2.5 grid gap-1.5 border-s border-line ps-3">
                  {steps.map((step) => (
                    <li
                      key={step.id}
                      className="flex flex-wrap items-baseline gap-x-2"
                    >
                      <span
                        dir="auto"
                        className={cn(
                          "text-[calc(13px*var(--text-scale,1))]",
                          step.status === "done"
                            ? "text-faint line-through decoration-line"
                            : "text-muted"
                        )}
                      >
                        {step.title}
                      </span>
                      {step.status !== "done" && pctOf(step) > 0 && (
                        <span className="font-mono text-[calc(11px*var(--text-scale,1))] tabular-nums text-faint rtl:font-sans">
                          {t.percent(pctOf(step))}
                        </span>
                      )}
                      {step.status === "blocked" && (
                        <MilestoneBadge
                          status={step.status}
                          label={milestoneStatusLabel(t, step.status)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[calc(11px*var(--text-scale,1))] text-faint rtl:font-sans">
                {milestone.done_on && (
                  <span className="text-primary-dim">
                    {t.doneOn(isolate(formatDateIn(locale, milestone.done_on)))}
                  </span>
                )}
                {milestone.target_on && !milestone.done_on && (
                  <span className={late ? "text-amber" : undefined}>
                    {t.targetOn(isolate(formatDateIn(locale, milestone.target_on)))}
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A phase's own completion, as a whole number for the bar. */
function pctOf(milestone: ProjectMilestone) {
  return Math.max(0, Math.min(100, Math.round(Number(milestone.completion) || 0)));
}

/** A percentage with no trailing zeroes — these sit inside sentences. */
function trim(value: number | string): string {
  return String(Math.round((Number(value) || 0) * 100) / 100);
}
