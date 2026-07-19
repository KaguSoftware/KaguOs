import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { getSessionContext, canAccess } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { getActivity } from "@/lib/data/activity";
import { PageHeader } from "@/components/shell/page-header";
import { Reminders } from "@/components/shell/reminders";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { ActivityFeed } from "@/components/shell/activity-feed";
import { AnnouncementHero } from "@/components/shell/announcement-hero";
import { PrefetchHeavy } from "@/components/shell/prefetch-heavy";
import { ShowcaseToggle } from "@/components/shell/showcase";
import { formatTRY, isActiveRecurring, monthlyAmount, toTRY, type FxRates } from "@/lib/finance";
import { todayInIstanbul } from "@/lib/utils";
import { SECTION_LABELS, type Announcement, type Reminder, type Section } from "@/lib/types";

/**
 * One section's numbers, as NUMBERS.
 *
 * This replaced six identical cards, each title + blurb + stat + arrow. Two
 * problems with those: they were navigation the sidebar already provides, and
 * "identical icon-card grids" is named in both DESIGN.md's bans and PRODUCT.md's
 * anti-references. The blurbs ("Projects and the ideas board") were filler, and
 * the stats — the only real content — were sentences like "12 open · 3 yours",
 * which don't scan. Values are separated from their labels so they can be
 * right-sized and read as data.
 */
type SectionStat = {
  section: Section;
  href: string;
  figures: { value: string; label: string }[];
};
type QuickAction = { label: string; href: string };

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const firstName = ctx.profile.full_name?.split(" ")[0] ?? ctx.profile.email;

  // ONE parallel wave for the whole dashboard. Every stat below is independent,
  // so each section's queries are built as a thunk and fired together with the
  // activity/members/reminders batch. Fetching these in section-by-section
  // waves costs one full network round-trip PER SECTION (~305ms each against
  // the Tokyo db) — serial, that's ~2s of dead air before anything renders.
  // Fired at once, the whole page costs about one round-trip. Keep it that way:
  // any new stat belongs INSIDE this wave, never in an await above it.
  // `.is("archived_at", null)` on BOTH: the board hides archived tasks, so
  // counting them here made the dashboard claim work that isn't on the board —
  // and the header says it out loud ("You have 3 debug tasks on your plate").
  // Filtering on state can't catch them, because an archived task IS done.
  const debugStats = canAccess(ctx, "debug")
    ? Promise.all([
        ctx.supabase
          .from("debug_tasks")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .is("archived_at", null)
          .eq("state", "open"),
        ctx.supabase
          .from("debug_tasks")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .is("archived_at", null)
          .eq("assignee_id", ctx.userId)
          .neq("state", "done"),
      ])
    : null;

  // The "needs you" strip. Same wave as everything else — these are counts on
  // an already-indexed table, and PRODUCT.md's first principle is that the
  // screen answers "what needs my attention?" before anything else, so they
  // can't sit behind a second round-trip.
  const attentionStats = canAccess(ctx, "debug")
    ? Promise.all([
        // Overdue: claimed by you, not done, deadline already passed.
        ctx.supabase
          .from("debug_tasks")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .is("archived_at", null)
          .eq("assignee_id", ctx.userId)
          .neq("state", "done")
          .lt("due_on", todayInIstanbul()),
        // Suggested for you and still unclaimed — the nudge only counts while
        // nobody has taken it, matching how the board renders it.
        ctx.supabase
          .from("debug_tasks")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .is("archived_at", null)
          .eq("suggested_for", ctx.userId)
          .is("assignee_id", null)
          .neq("state", "done"),
      ])
    : null;

  const workStats = canAccess(ctx, "work")
    ? Promise.all([
        ctx.supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .eq("status", "active"),
        ctx.supabase
          .from("ideas")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .eq("status", "open"),
      ])
    : null;

  const learnStats = canAccess(ctx, "learn")
    ? (() => {
        const today = todayInIstanbul();
        return ctx.supabase
          .from("sprints")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .lte("starts_on", today)
          .gte("ends_on", today);
      })()
    : null;

  const managementStats = canAccess(ctx, "management")
    ? Promise.all([
        ctx.supabase
          .from("recurring_items")
          .select("*")
          .eq("is_demo", ctx.showcase)
          .is("canceled_on", null),
        ctx.supabase.from("fx_rates").select("currency, rate_to_try"),
      ])
    : null;

  const marketingStats = canAccess(ctx, "marketing")
    ? ctx.supabase
        .from("marketing_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("is_demo", ctx.showcase)
        .eq("status", "running")
    : null;

  const commsStats = canAccess(ctx, "comms")
    ? Promise.all([
        ctx.supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .eq("kind", "lead"),
        ctx.supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .eq("kind", "client"),
      ])
    : null;

  const [
    attentionRes,
    debugRes,
    workRes,
    learnRes,
    managementRes,
    marketingRes,
    commsRes,
    activity,
    members,
    remindersRes,
    annRes,
  ] = await Promise.all([
    attentionStats,
    debugStats,
    workStats,
    learnStats,
    managementStats,
    marketingStats,
    commsStats,
    getActivity(ctx),
    getMembersMap(ctx.supabase),
    // Reminders + announcements have no demo equivalent (no is_demo column) and
    // hold real personal notes / real company announcements, so both are
    // skipped in showcase mode — nothing real reaches a client being demoed.
    ctx.showcase
      ? null
      : ctx.supabase
          .from("reminders")
          .select("*")
          .order("done", { ascending: true })
          .order("created_at", { ascending: false }),
    ctx.showcase
      ? null
      : ctx.supabase
          .from("announcements")
          .select("*")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1),
  ]);

  // Assemble the stat row in a stable, deliberate order once the data landed.
  const stats: SectionStat[] = [];
  let myTasks = 0;

  if (debugRes) {
    const [{ count: open }, { count: mine }] = debugRes;
    myTasks = mine ?? 0;
    stats.push({
      section: "debug",
      href: "/debug",
      figures: [
        { value: `${open ?? 0}`, label: "open" },
        { value: `${mine ?? 0}`, label: "yours" },
      ],
    });
  }

  if (workRes) {
    const [{ count: active }, { count: ideas }] = workRes;
    stats.push({
      section: "work",
      href: "/work",
      figures: [
        { value: `${active ?? 0}`, label: "projects" },
        { value: `${ideas ?? 0}`, label: "ideas" },
      ],
    });
  }

  if (learnRes) {
    const { count: active } = learnRes;
    stats.push({
      section: "learn",
      href: "/learn",
      figures: [
        { value: `${active ?? 0}`, label: active === 1 ? "sprint" : "sprints" },
      ],
    });
  }

  if (managementRes) {
    const [{ data: recurring }, { data: fx }] = managementRes;
    const rates: FxRates = {};
    for (const r of fx ?? []) rates[r.currency as "USD" | "EUR"] = Number(r.rate_to_try);
    let net = 0;
    for (const item of (recurring ?? []).filter(isActiveRecurring)) {
      const v = toTRY(monthlyAmount(item), item.currency, rates);
      if (v !== null) net += item.type === "income" ? v : -v;
    }
    stats.push({
      section: "management",
      href: "/management/finance",
      figures: [
        {
          value: `${net >= 0 ? "+" : ""}${formatTRY(net)}`,
          label: "recurring/mo",
        },
      ],
    });
  }

  if (marketingRes) {
    const { count: running } = marketingRes;
    stats.push({
      section: "marketing",
      href: "/marketing",
      figures: [
        {
          value: `${running ?? 0}`,
          label: running === 1 ? "campaign" : "campaigns",
        },
      ],
    });
  }

  if (commsRes) {
    const [{ count: leads }, { count: clients }] = commsRes;
    stats.push({
      section: "comms",
      href: "/comms",
      figures: [
        { value: `${leads ?? 0}`, label: "leads" },
        { value: `${clients ?? 0}`, label: "clients" },
      ],
    });
  }

  // What actually needs this person today. Rendered above everything else.
  const [overdueRes, suggestedRes] = attentionRes ?? [];
  const overdueCount = overdueRes?.count ?? 0;
  const suggestedCount = suggestedRes?.count ?? 0;

  // Quick actions — the one-click primitives, gated by what you can reach.
  const actions: QuickAction[] = [];
  if (canAccess(ctx, "debug"))
    actions.push({ label: "New task", href: "/debug/new" });
  if (canAccess(ctx, "work")) {
    actions.push({ label: "New idea", href: "/work/ideas/new" });
    actions.push({ label: "New project", href: "/work/projects/new" });
  }
  if (canAccess(ctx, "management")) {
    actions.push({ label: "New transaction", href: "/management/finance/new-transaction" });
    actions.push({ label: "New contract", href: "/management/contracts/new" });
  }
  if (canAccess(ctx, "marketing"))
    actions.push({ label: "New campaign", href: "/marketing/new-campaign" });
  if (canAccess(ctx, "comms"))
    actions.push({ label: "New contact", href: "/comms/new" });
  if (ctx.isAdmin)
    actions.push({ label: "New sprint", href: "/learn/new" });

  // Only the first few surface here. Seven equal-weight "New …" buttons sat
  // above every piece of information on the page, but creating is the rarer
  // dashboard action — most visits are "what's happening?". The rest stay one
  // ⌘K away; the palette already indexes every create route.
  const QUICK_ACTION_LIMIT = 3;
  const shownActions = actions.slice(0, QUICK_ACTION_LIMIT);

  // Heavy, data-dense routes worth warming in the background from the dashboard.
  const heavyRoutes: string[] = [];
  if (canAccess(ctx, "management")) heavyRoutes.push("/management/finance");
  if (canAccess(ctx, "debug")) heavyRoutes.push("/debug");

  const reminders = ((remindersRes?.data ?? []) as Reminder[]);
  const announcement = ((annRes?.data ?? []) as Announcement[])[0] ?? null;

  return (
    <>
      {/* Live dashboard: team reminders + the announcement banner update in
          place. Skipped in showcase (both are hidden there). */}
      {!ctx.showcase && (
        <LiveRefresh tables={["reminders", "announcements"]} />
      )}
      <PageHeader
        title={`Hey, ${firstName}`}
        description={
          canAccess(ctx, "debug") && myTasks > 0
            ? `You have ${myTasks} debug ${myTasks === 1 ? "task" : "tasks"} on your plate.`
            : "Everything Kagu runs on, in one quiet place."
        }
      />
      <AnnouncementHero announcement={announcement} isAdmin={ctx.isAdmin} />
      <PrefetchHeavy routes={heavyRoutes} />

      {/* What needs YOU, before anything else on the page. Each count links
          straight to the matching view rather than to the section's front door,
          so the number is actionable and not just informative. */}
      {canAccess(ctx, "debug") && (overdueCount > 0 || suggestedCount > 0) && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
            Needs you
          </span>
          {overdueCount > 0 && (
            <Link
              href="/debug?preset=mine&sort=deadline"
              className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-[13px] text-danger transition-colors duration-150 hover:bg-danger/15"
            >
              <span className="font-mono font-medium">{overdueCount}</span>
              overdue
            </Link>
          )}
          {suggestedCount > 0 && (
            <Link
              href="/debug"
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:border-line-strong hover:bg-raised hover:text-ink"
            >
              <span className="font-mono font-medium text-ink">
                {suggestedCount}
              </span>
              suggested for you
            </Link>
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {shownActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors duration-150 hover:border-primary/40 hover:bg-raised hover:text-ink"
          >
            <Plus className="size-3.5 text-faint" aria-hidden />
            {action.label}
          </Link>
        ))}
        {actions.length > shownActions.length && (
          <span className="text-[11px] text-faint">
            more with <kbd className="font-mono">⌘K</kbd>
          </span>
        )}
      </div>
      <div className="mb-6">
        <Reminders reminders={reminders} members={members} meId={ctx.userId} />
      </div>
      {/* One dense row of numbers, not six cards. Each section is a column of
          figures; the section name is the link. Values are mono and sized up so
          the row scans as data, which is what it always was. */}
      {stats.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <Link
              key={s.section}
              href={s.href}
              className="group bg-surface p-3 transition-colors duration-150 hover:bg-raised"
            >
              <span className="flex items-center gap-1 text-[11px] text-faint">
                {SECTION_LABELS[s.section].replace("Kagu ", "")}
                <ArrowUpRight
                  className="size-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  aria-hidden
                />
              </span>
              <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {s.figures.map((f) => (
                  <span key={f.label} className="flex items-baseline gap-1">
                    <span className="font-mono text-[15px] font-medium text-ink tabular-nums">
                      {f.value}
                    </span>
                    <span className="text-[11px] text-muted">{f.label}</span>
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Activity is the only genuinely live thing here, so it gets the full
          width rather than a 20rem rail that dropped below six cards of
          navigation on anything narrower than lg. */}
      <ActivityFeed items={activity} members={members} />

      {/* Showcase is a MODE SWITCH that changes every number above. It used to
          sit as the 8th chip in a row of "New …" links, one mis-click away.
          Down here, alone, it reads as the deliberate act it is. */}
      {!ctx.showcase && (
        <div className="mt-8 flex justify-end border-t border-line pt-4">
          <ShowcaseToggle />
        </div>
      )}
    </>
  );
}
