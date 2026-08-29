import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
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
import { PortalLinks, portalLinkRows } from "@/components/portal/links";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";
import { dict, milestoneStatusLabel } from "@/lib/i18n";
import {
  cn,
  formatDateIn,
  formatRelativeIn,
  isolate,
  todayInIstanbul,
} from "@/lib/utils";

/**
 * `generateMetadata` rather than a static `metadata`, because the tab title is
 * chrome like everything else here and a client reading Arabic should not be
 * left with an English tab. It reads the same cookie the layout does.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: dict(locale).yourDashboard };
}

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
 *
 * ── Language ─────────────────────────────────────────────────
 *
 * Every word comes from `dict(locale)` — the headline sentence included, which
 * is a function IN the dictionary rather than assembled here. English wants a
 * comma-and list with a leading capital and Arabic wants neither, so a join
 * written in this file would have to know both.
 *
 * The arrows carry `rtl:rotate-180` and `rtl:translate-x-1`: a "keep going"
 * arrow that points left on a right-to-left page reads as "back", and one that
 * mirrors its glyph but keeps sliding left-to-right on hover reads as broken.
 *
 * Dates, percentages and elapsed time go through the locale-aware formatters
 * rather than the plain ones, and every staff-typed string — a business name, a
 * milestone title — is wrapped in `<bdi>` with its separators emitted as their
 * own nodes. A `·` or `—` left as leading or trailing text beside an Arabic run
 * is bidi-neutral, so it takes the paragraph direction and lands on the wrong
 * side of the phrase it was meant to separate.
 */
export default async function PortalDashboardPage() {
  const portal = await loadPortal();
  const today = todayInIstanbul();
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = dict(locale);
  // Greeted by the WHOLE name, not the first word of it. The split was written
  // for "Sarah Ahmed" and is wrong for most of the people this portal is for:
  // "عبد الرحمن" is one name in two words, and taking the first leaves "عبد" —
  // "servant of", a fragment nobody is called — in the largest text on the page.
  // Arabic has no reliable way to find the given name by splitting on spaces
  // (عبد ال…، أبو…، and compound names all break it), so the honest greeting is
  // the name as its owner typed it.
  const greetingName = (portal.ctx.profile.full_name || "").trim();

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
      // The compact version — label and address only. The detail paragraph
      // ("send us the Apple ID you use") belongs on Progress, where there is
      // room for it; a card that carries it stops being a card.
      links: portalLinkRows(portal.linksByProject.get(project.id) ?? [], milestones),
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
    .flatMap((entry) => {
      // A sub-phase title is not self-describing: four tracks each have a
      // "Week 3", so the feed names the phase it sits inside. Deliberately a
      // flat list — a step moving IS the news here, which is the one place
      // both levels belong side by side.
      const titles = new Map(entry.milestones.map((m) => [m.id, m.title]));
      return entry.milestones.map((milestone) => ({
        milestone,
        parentTitle: milestone.parent_id
          ? (titles.get(milestone.parent_id) ?? null)
          : null,
        projectName: entry.project.name,
      }));
    })
    .filter((row) => row.milestone.status !== "planned")
    .sort((a, b) => b.milestone.updated_at.localeCompare(a.milestone.updated_at))
    .slice(0, 5);

  return (
    <>
      <LiveRefresh
        tables={[
          "project_milestones",
          "project_invoices",
          "project_links",
          "project_intake",
        ]}
      />

      <PageHeader
        title={greetingName ? t.hello(greetingName) : t.yourDashboard}
        description={t.headline(packsOpen.length, overdueCount, blockedCount)}
      />

      {portal.projects.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={Building2}
            title={t.nothingSharedTitle}
            hint={t.dashNothingSharedHint}
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
                        <>
                          <bdi className="text-muted">{entry.project.name}</bdi>
                          <span className="text-muted" aria-hidden> — </span>
                        </>
                      )}
                      {entry.packPct === 0
                        ? t.packNotStarted
                        : t.packFilledIn(entry.packPct)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-amber rtl:font-sans">
                      {t.finishIt}
                      <ArrowRight
                        className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 ease-mac group-hover:translate-x-0 group-hover:opacity-100 rtl:translate-x-1 rtl:rotate-180"
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
                      {t.invoicesOverdue(overdueCount)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-danger rtl:font-sans">
                      {t.seeFinance}
                      <ArrowRight
                        className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 ease-mac group-hover:translate-x-0 group-hover:opacity-100 rtl:translate-x-1 rtl:rotate-180"
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
              {t.nothingNeedsYou}
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
                  <h2 dir="auto" className="min-w-0 text-sm font-semibold text-ink">
                    {entry.project.name}
                  </h2>
                  {entry.build.next ? (
                    <MilestoneBadge
                      status={entry.build.next.status}
                      label={milestoneStatusLabel(t, entry.build.next.status)}
                    />
                  ) : entry.build.total > 0 ? (
                    <MilestoneBadge status="done" label={t.statusDone} />
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-3">
                  <div>
                    <dt className="flex items-baseline justify-between gap-3 font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint rtl:font-sans rtl:normal-case rtl:tracking-normal">
                      <span>{t.build}</span>
                      <span className="tabular-nums">{t.percent(entry.build.pct)}</span>
                    </dt>
                    <dd className="mt-1.5">
                      <ProgressMeter
                        pct={entry.build.pct}
                        done={entry.build.done}
                        total={entry.build.total}
                        label={t.buildProgressAria(entry.project.name)}
                      />
                    </dd>
                  </div>

                  <div>
                    <dt className="flex items-baseline justify-between gap-3 font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint rtl:font-sans rtl:normal-case rtl:tracking-normal">
                      <span>{t.yourInputPack}</span>
                      <span className="tabular-nums">{t.percent(entry.packPct)}</span>
                    </dt>
                    <dd className="mt-1.5">
                      <ProgressMeter
                        pct={entry.packPct}
                        done={entry.packDone}
                        total={entry.packTotal}
                        label={t.packProgressAria(entry.project.name)}
                      />
                    </dd>
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <dt className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint rtl:font-sans rtl:normal-case rtl:tracking-normal">
                      {t.outstanding}
                    </dt>
                    <dd>
                      <Money
                        bucket={entry.totals.outstanding}
                        tone={entry.totals.overdueCount > 0 ? "danger" : "ink"}
                        locale={locale}
                      />
                    </dd>
                  </div>
                </dl>

                {entry.build.next && (
                  <p className="mt-4 border-t border-line pt-3 text-[calc(13px*var(--text-scale,1))] text-muted">
                    <span className="text-faint">{t.nextUp}</span>
                    <span className="text-faint" aria-hidden> · </span>
                    <bdi>{entry.build.next.title}</bdi>
                    {entry.build.next.target_on && (
                      <>
                        <span className="text-faint" aria-hidden> · </span>
                        <span className="text-faint">
                          {t.targetOn(
                            isolate(formatDateIn(locale, entry.build.next.target_on))
                          )}
                        </span>
                      </>
                    )}
                  </p>
                )}

                {/* What they can go and open, if anything (0082). On the card
                    rather than only on Progress because "can I see it yet?" is
                    a fourth reason to open this app, and a client who has one
                    should not have to navigate to find out. */}
                {entry.links.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="font-mono text-[calc(10px*var(--text-scale,1))] uppercase tracking-wider text-faint rtl:font-sans rtl:normal-case rtl:tracking-normal">
                      {t.takeALook}
                    </p>
                    <PortalLinks className="mt-2" rows={entry.links} t={t} compact />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[calc(11px*var(--text-scale,1))] uppercase tracking-wider rtl:font-sans rtl:normal-case rtl:tracking-normal">
                  <Link
                    href={`/portal/inputs/${entry.project.id}`}
                    className="text-faint transition-colors duration-150 hover:text-ink"
                  >
                    {t.navInputs}
                  </Link>
                  <Link
                    href="/portal/progress"
                    className="text-faint transition-colors duration-150 hover:text-ink"
                  >
                    {t.navProgress}
                  </Link>
                  <Link
                    href="/portal/finance"
                    className="text-faint transition-colors duration-150 hover:text-ink"
                  >
                    {t.navFinance}
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
                {t.recently}
              </h2>
              <ul className="grid gap-2">
                {recent.map(({ milestone, parentTitle, projectName }) => (
                  <li
                    key={milestone.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                  >
                    <MilestoneBadge
                      status={milestone.status}
                      label={milestoneStatusLabel(t, milestone.status)}
                    />
                    <span className="min-w-0 flex-1 text-[calc(13px*var(--text-scale,1))] text-ink">
                      {parentTitle && (
                        <>
                          <bdi className="text-faint">{parentTitle}</bdi>
                          <span className="text-faint" aria-hidden> · </span>
                        </>
                      )}
                      <bdi>{milestone.title}</bdi>
                      {businesses.length > 1 && (
                        <>
                          <span className="text-faint" aria-hidden> · </span>
                          <bdi className="text-faint">{projectName}</bdi>
                        </>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[calc(11px*var(--text-scale,1))] text-faint rtl:font-sans">
                      {formatRelativeIn(locale, milestone.updated_at, t.justNow)}
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
