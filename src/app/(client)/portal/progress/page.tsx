import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Route, TriangleAlert } from "lucide-react";
import { loadPortal, milestoneProgress } from "@/lib/data/portal";
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
import type { ProjectMilestone } from "@/lib/types";
import { cn, formatDate, todayInIstanbul } from "@/lib/utils";

export const metadata: Metadata = { title: "Progress" };

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
 */
export default async function PortalProgressPage() {
  const portal = await loadPortal();
  const today = todayInIstanbul();

  return (
    <>
      <LiveRefresh
        tables={["project_milestones", "project_intake", "project_intake_answers"]}
      />

      <PageHeader
        title="Progress"
        description="What Kagu has finished, what's underway, and what we're waiting on."
      />

      {portal.projects.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={Building2}
            title="Nothing shared with you yet"
            hint="As soon as Kagu shares a project with your account, its plan appears here."
          />
        </div>
      ) : (
        <div className="grid gap-10">
          {portal.projects.map((project) => {
            const milestones = portal.milestonesByProject.get(project.id) ?? [];
            const build = milestoneProgress(milestones);
            const intake = portal.intake.get(project.id);
            const packPct = intake?.progress.pct ?? 0;
            const packSent = Boolean(intake?.submittedAt);

            return (
              <section key={project.id}>
                <BusinessHeading
                  name={project.name}
                  action={
                    build.total > 0 ? (
                      <span className="font-mono text-xs tabular-nums text-faint">
                        {build.done}/{build.total} done
                      </span>
                    ) : undefined
                  }
                />

                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  <Panel className="p-4">
                    <p className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                      The build
                    </p>
                    <p className="mt-1.5 text-[calc(19px*var(--text-scale,1))] font-medium tabular-nums text-ink">
                      {build.pct}%
                    </p>
                    <ProgressMeter
                      className="mt-2"
                      pct={build.pct}
                      done={build.done}
                      total={build.total}
                      label={`${project.name} build progress`}
                    />
                    <p className="mt-2 text-[calc(12px*var(--text-scale,1))] text-faint">
                      {build.next
                        ? `Next: ${build.next.title}`
                        : build.total === 0
                          ? "The plan hasn't been shared yet"
                          : "Everything on the plan is done"}
                    </p>
                  </Panel>

                  <Panel className="p-4">
                    <p className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                      Your input pack
                    </p>
                    <p className="mt-1.5 text-[calc(19px*var(--text-scale,1))] font-medium tabular-nums text-ink">
                      {packPct}%
                    </p>
                    <ProgressMeter
                      className="mt-2"
                      pct={packPct}
                      done={intake?.progress.done ?? 0}
                      total={intake?.progress.total ?? 0}
                      label={`${project.name} input pack completion`}
                    />
                    <p className="mt-2 text-[calc(12px*var(--text-scale,1))]">
                      {packSent ? (
                        <span className="text-primary-dim">Sent to Kagu — thank you</span>
                      ) : (
                        <Link
                          href={`/portal/inputs/${project.id}`}
                          className="text-muted underline-offset-2 hover:text-ink hover:underline"
                        >
                          Carry on filling it in →
                        </Link>
                      )}
                    </p>
                  </Panel>
                </div>

                {build.blocked.length > 0 && (
                  <div className="mb-5 rounded-md border border-danger/30 bg-danger/5 p-4">
                    <p className="flex items-center gap-2 text-[calc(13px*var(--text-scale,1))] font-medium text-danger">
                      <TriangleAlert className="size-4" aria-hidden />
                      {build.blocked.length === 1
                        ? "One thing is blocked"
                        : `${build.blocked.length} things are blocked`}
                    </p>
                    <ul className="mt-2 grid gap-1.5">
                      {build.blocked.map((milestone) => (
                        <li
                          key={milestone.id}
                          className="text-[calc(13px*var(--text-scale,1))] text-muted"
                        >
                          <span className="text-ink">{milestone.title}</span>
                          {milestone.detail && <> — {milestone.detail}</>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {milestones.length === 0 ? (
                  <div className="rounded-lg border border-line bg-surface">
                    <EmptyState
                      icon={Route}
                      title="No plan shared yet"
                      hint="Kagu will publish the steps of this build here. Until then, the input pack is the thing to get on with."
                    />
                  </div>
                ) : (
                  <Timeline milestones={milestones} today={today} />
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

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
  today,
}: {
  milestones: ProjectMilestone[];
  today: string;
}) {
  return (
    <ol className="relative grid gap-0">
      {milestones.map((milestone, index) => {
        const last = index === milestones.length - 1;
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
                  className={cn(
                    "min-w-0 text-[calc(14px*var(--text-scale,1))] font-medium",
                    milestone.status === "done" ? "text-muted" : "text-ink"
                  )}
                >
                  {milestone.title}
                </p>
                <MilestoneBadge status={milestone.status} />
              </div>

              {milestone.detail && (
                <p className="mt-1 max-w-[70ch] whitespace-pre-wrap text-[calc(13px*var(--text-scale,1))] leading-relaxed text-muted">
                  {milestone.detail}
                </p>
              )}

              <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
                {milestone.done_on && (
                  <span className="text-primary-dim">
                    done {formatDate(milestone.done_on)}
                  </span>
                )}
                {milestone.target_on && !milestone.done_on && (
                  <span className={late ? "text-amber" : undefined}>
                    target {formatDate(milestone.target_on)}
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
