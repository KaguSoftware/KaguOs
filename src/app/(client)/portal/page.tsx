import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Receipt,
  Route,
} from "lucide-react";
import { invoiceTotals, loadPortal, milestoneProgress } from "@/lib/data/portal";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { Panel } from "@/components/ui/panel";
import { ProgressMeter } from "@/components/portal/progress-meter";
import { Money, MilestoneBadge } from "@/components/portal/bits";
import { cn, formatDate, formatRelative, todayInIstanbul } from "@/lib/utils";

export const metadata: Metadata = { title: "Your dashboard" };

/**
 * The client's front page.
 *
 * ── What it is arranged around ─────────────────────────────────────────────
 *
 * Not "here is your data". A client opens this app for one of exactly three
 * reasons — something is owed FROM them, something is owed TO them, or they
 * want to know where the build is — so the page is those three, in that order,
 * and the first thing on it is a single sentence saying which of them currently
 * applies. Somebody who has nothing outstanding should be able to close the tab
 * in four seconds having learned that, rather than reading three panels to
 * discover there was nothing to read.
 *
 * ── Why the business cards carry three numbers and not one ─────────────────
 *
 * A client with two businesses is really running two relationships with Kagu,
 * and they can be in completely different states: one built and unpaid, one
 * unstarted and waiting on a menu. A single "progress" figure per business
 * would average those into a number that describes neither. So each card shows
 * the build, the pack and the money side by side, and the card is a link into
 * whichever of them the reader was actually worried about.
 */
export default async function PortalDashboardPage() {
  const portal = await loadPortal();
  const today = todayInIstanbul();
  const firstName = (portal.ctx.profile.full_name || "").trim().split(" ")[0];

  const businesses = portal.projects.map((project) => {
    const milestones = portal.milestonesByProject.get(project.id) ?? [];
    const invoices = portal.invoicesByProject.get(project.id) ?? [];
    const intake = portal.intake.get(project.id);
    return {
      project,
      build: milestoneProgress(milestones),
      totals: invoiceTotals(invoices, today),
      packPct: intake?.progress.pct ?? 0,
      packDone: intake?.progress.done ?? 0,
      packTotal: intake?.progress.total ?? 0,
      packSent: Boolean(intake?.submittedAt),
      milestones,
    };
  });

  const packsOpen = businesses.filter((entry) => !entry.packSent);
  const overdueCount = businesses.reduce(
    (sum, entry) => sum + entry.totals.overdueCount,
    0
  );
  const blockedCount = businesses.reduce(
    (sum, entry) => sum + entry.build.blocked.length,
    0
  );

  // Everything published across every business, most recently touched first —
  // the "what changed since I last looked" line, which is the only thing on
  // this page that is genuinely a feed.
  const recent = businesses
    .flatMap((entry) =>
      entry.milestones.map((milestone) => ({
        milestone,
        projectName: entry.project.name,
      }))
    )
    .filter((row) => row.milestone.status !== "planned")
    .sort((a, b) => b.milestone.updated_at.localeCompare(a.milestone.updated_at))
    .slice(0, 5);

  return (
    <>
      <LiveRefresh
        tables={["project_milestones", "project_invoices", "project_intake"]}
      />

      <PageHeader
        title={firstName ? `Hello, ${firstName}` : "Your dashboard"}
        description={headline(packsOpen.length, overdueCount, blockedCount)}
      />

      {portal.projects.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={Building2}
            title="Nothing shared with you yet"
            hint="Your account is set up. As soon as Kagu shares a project with it, everything about that build shows up here — you'll be told, so there's no need to keep checking."
          />
        </div>
      ) : (
        <div className="grid gap-8">
          {/* ---- What needs you, if anything. Above the businesses, because a
              client who has an action outstanding should not have to find it
              inside a card. */}
          {(packsOpen.length > 0 || overdueCount > 0) && (
            <ul className="grid gap-2">
              {packsOpen.map((entry) => (
                <li key={entry.project.id}>
                  <Link
                    href={`/portal/inputs/${entry.project.id}`}
                    className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber/25 bg-amber/5 px-4 py-3 transition-colors duration-150 hover:border-amber/40"
                  >
                    <ClipboardList className="size-4 shrink-0 text-amber" aria-hidden />
                    <span className="min-w-0 flex-1 text-[calc(13px*var(--text-scale,1))] text-ink">
                      {portal.projects.length > 1 && (
                        <span className="text-muted">{entry.project.name} — </span>
                      )}
                      {entry.packPct === 0
                        ? "your input pack hasn't been started"
                        : `your input pack is ${entry.packPct}% filled in`}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-amber">
                      finish it
                      <ArrowRight
                        className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 ease-mac group-hover:translate-x-0 group-hover:opacity-100"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}

              {overdueCount > 0 && (
                <li>
                  <Link
                    href="/portal/finance"
                    className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 transition-colors duration-150 hover:border-danger/50"
                  >
                    <Receipt className="size-4 shrink-0 text-danger" aria-hidden />
                    <span className="min-w-0 flex-1 text-[calc(13px*var(--text-scale,1))] text-ink">
                      {overdueCount === 1
                        ? "One invoice is past its due date"
                        : `${overdueCount} invoices are past their due date`}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-danger">
                      see finance
                      <ArrowRight
                        className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 ease-mac group-hover:translate-x-0 group-hover:opacity-100"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              )}
            </ul>
          )}

          {packsOpen.length === 0 && overdueCount === 0 && (
            <p className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-[calc(13px*var(--text-scale,1))] text-primary-dim">
              <CheckCircle2 className="size-4" aria-hidden />
              Nothing needs you right now — everything is on our side.
            </p>
          )}

          {/* ---- One card per business. */}
          <div
            className={cn(
              "grid gap-3",
              businesses.length > 1 && "md:grid-cols-2"
            )}
          >
            {businesses.map((entry) => (
              <Panel key={entry.project.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="min-w-0 text-sm font-semibold text-ink">
                    {entry.project.name}
                  </h2>
                  {entry.build.next ? (
                    <MilestoneBadge status={entry.build.next.status} />
                  ) : entry.build.total > 0 ? (
                    <MilestoneBadge status="done" />
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-3">
                  <div>
                    <dt className="flex items-baseline justify-between gap-3 font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                      <span>Build</span>
                      <span className="tabular-nums">{entry.build.pct}%</span>
                    </dt>
                    <dd className="mt-1.5">
                      <ProgressMeter
                        pct={entry.build.pct}
                        done={entry.build.done}
                        total={entry.build.total}
                        label={`${entry.project.name} build progress`}
                      />
                    </dd>
                  </div>

                  <div>
                    <dt className="flex items-baseline justify-between gap-3 font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                      <span>Your input pack</span>
                      <span className="tabular-nums">{entry.packPct}%</span>
                    </dt>
                    <dd className="mt-1.5">
                      <ProgressMeter
                        pct={entry.packPct}
                        done={entry.packDone}
                        total={entry.packTotal}
                        label={`${entry.project.name} input pack completion`}
                      />
                    </dd>
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <dt className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint">
                      Outstanding
                    </dt>
                    <dd>
                      <Money
                        bucket={entry.totals.outstanding}
                        tone={entry.totals.overdueCount > 0 ? "danger" : "ink"}
                      />
                    </dd>
                  </div>
                </dl>

                {entry.build.next && (
                  <p className="mt-4 border-t border-line pt-3 text-[calc(13px*var(--text-scale,1))] text-muted">
                    <span className="text-faint">Next up · </span>
                    {entry.build.next.title}
                    {entry.build.next.target_on && (
                      <span className="text-faint">
                        {" "}
                        · target {formatDate(entry.build.next.target_on)}
                      </span>
                    )}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider">
                  <Link
                    href={`/portal/inputs/${entry.project.id}`}
                    className="text-faint transition-colors duration-150 hover:text-ink"
                  >
                    Inputs
                  </Link>
                  <Link
                    href="/portal/progress"
                    className="text-faint transition-colors duration-150 hover:text-ink"
                  >
                    Progress
                  </Link>
                  <Link
                    href="/portal/finance"
                    className="text-faint transition-colors duration-150 hover:text-ink"
                  >
                    Finance
                  </Link>
                </div>
              </Panel>
            ))}
          </div>

          {/* ---- What moved recently. Only when there is something to say:
              an empty "recent activity" panel is a promise the page keeps
              failing to keep. */}
          {recent.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 border-b border-line pb-2.5 text-[calc(16px*var(--text-scale,1))] font-semibold tracking-tight text-ink">
                <Route className="size-4 text-faint" aria-hidden />
                Recently
              </h2>
              <ul className="grid gap-2">
                {recent.map(({ milestone, projectName }) => (
                  <li
                    key={milestone.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                  >
                    <MilestoneBadge status={milestone.status} />
                    <span className="min-w-0 flex-1 text-[calc(13px*var(--text-scale,1))] text-ink">
                      {milestone.title}
                      {businesses.length > 1 && (
                        <span className="text-faint"> · {projectName}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] text-faint">
                      {formatRelative(milestone.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>
      )}
    </>
  );
}

/**
 * The sentence under the greeting.
 *
 * One line, and it must be the TRUE one — the temptation with a page like this
 * is a cheerful constant, which teaches the reader within two visits that the
 * line means nothing and to skip it.
 */
function headline(packsOpen: number, overdue: number, blocked: number): string {
  const parts: string[] = [];
  if (packsOpen > 0) {
    parts.push(
      packsOpen === 1
        ? "one input pack still needs finishing"
        : `${packsOpen} input packs still need finishing`
    );
  }
  if (overdue > 0) {
    parts.push(
      overdue === 1 ? "one invoice is past due" : `${overdue} invoices are past due`
    );
  }
  if (blocked > 0) {
    parts.push(
      blocked === 1 ? "one step is blocked" : `${blocked} steps are blocked`
    );
  }
  if (parts.length === 0) {
    return "Everything is with us — nothing is waiting on you.";
  }
  const sentence =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
