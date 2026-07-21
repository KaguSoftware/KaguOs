import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { getSessionContext, canAccess } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { rowsOrThrow, selectOrThrow } from "@/lib/data/query";
import { getActivity } from "@/lib/data/activity";
import { PageHeader } from "@/components/shell/page-header";
import { Reminders } from "@/components/shell/reminders";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { ActivityFeed } from "@/components/shell/activity-feed";
import { AnnouncementHero } from "@/components/shell/announcement-hero";
import { PrefetchHeavy } from "@/components/shell/prefetch-heavy";
import { ShowcaseToggle } from "@/components/shell/showcase";
import { formatTRY, isActiveRecurring, monthlyAmount, toTRY, type FxRates } from "@/lib/finance";
import { addDays, cn, todayInIstanbul } from "@/lib/utils";
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
        selectOrThrow(
          ctx.supabase
            .from("debug_tasks")
            .select("id", { count: "exact", head: true })
            .eq("is_demo", ctx.showcase)
            .is("archived_at", null)
            .eq("state", "open"),
          "debug open count"
        ),
        selectOrThrow(
          ctx.supabase
            .from("debug_tasks")
            .select("id", { count: "exact", head: true })
            .eq("is_demo", ctx.showcase)
            .is("archived_at", null)
            .eq("assignee_id", ctx.userId)
            .neq("state", "done"),
          "debug mine count"
        ),
      ])
    : null;

  // The "needs you" strip. Same wave as everything else — these are counts on
  // an already-indexed table, and PRODUCT.md's first principle is that the
  // screen answers "what needs my attention?" before anything else, so they
  // can't sit behind a second round-trip.
  const attentionStats = canAccess(ctx, "debug")
    ? Promise.all([
        // Overdue: claimed by you, not done, deadline already passed.
        selectOrThrow(
          ctx.supabase
            .from("debug_tasks")
            .select("id", { count: "exact", head: true })
            .eq("is_demo", ctx.showcase)
            .is("archived_at", null)
            .eq("assignee_id", ctx.userId)
            .neq("state", "done")
            .lt("due_on", todayInIstanbul()),
          "overdue count"
        ),
        // Suggested for you and still unclaimed — the nudge only counts while
        // nobody has taken it, matching how the board renders it.
        selectOrThrow(
          ctx.supabase
            .from("debug_tasks")
            .select("id", { count: "exact", head: true })
            .eq("is_demo", ctx.showcase)
            .is("archived_at", null)
            .eq("suggested_for", ctx.userId)
            .is("assignee_id", null)
            .neq("state", "done"),
          "suggested count"
        ),
      ])
    : null;

  // ---- the rest of "Needs you" ----
  // The strip used to answer the attention question for DEBUG ONLY, while
  // PRODUCT.md's first principle is that every screen answers "what needs my
  // attention?" first. These three widen it. All ride the SAME wave — see the
  // rule at the top of this file; a second wave costs a full round-trip.

  // Learn: goals you haven't ticked in the sprint running RIGHT NOW.
  // ⚠️ Not "goals due" — `sprint_goals` has no due date (it's ordered, not
  // scheduled). The sprint's own ends_on supplies the urgency instead.
  const learnAttention = canAccess(ctx, "learn")
    ? (async () => {
        const today = todayInIstanbul();
        const { data: sprint } = await selectOrThrow(
          ctx.supabase
            .from("sprints")
            .select("id, title, ends_on")
            .eq("is_demo", ctx.showcase)
            .lte("starts_on", today)
            .gte("ends_on", today)
            .order("ends_on", { ascending: true })
            .limit(1)
            .maybeSingle(),
          "active sprint"
        );
        if (!sprint) return null;
        const [goals, mine] = await Promise.all([
          rowsOrThrow(
            ctx.supabase
              .from("sprint_goals")
              .select("id")
              .eq("sprint_id", sprint.id)
              .eq("is_demo", ctx.showcase),
            "sprint goals"
          ),
          rowsOrThrow(
            ctx.supabase
              .from("sprint_goal_progress")
              .select("goal_id")
              .eq("user_id", ctx.userId),
            "my goal progress"
          ),
        ]);
        const ticked = new Set(mine.map((m) => m.goal_id));
        const left = goals.filter((g) => !ticked.has(g.id)).length;
        return left > 0 ? { sprintId: sprint.id, left } : null;
      })()
    : null;

  // Your own reminders that have slipped. Skipped in showcase for the same
  // reason the reminders panel is: they're real personal notes.
  const reminderAttention = ctx.showcase
    ? null
    : selectOrThrow(
        ctx.supabase
          .from("reminders")
          .select("id", { count: "exact", head: true })
          .eq("done", false)
          .lt("due_on", todayInIstanbul()),
        "overdue reminders count"
      );

  // Contracts running out inside 30 days — the one management signal with a
  // real deadline attached.
  const contractAttention = canAccess(ctx, "management")
    ? selectOrThrow(
        ctx.supabase
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .eq("status", "active")
          .gte("ends_on", todayInIstanbul())
          .lte("ends_on", addDays(todayInIstanbul(), 30)),
        "expiring contracts count"
      )
    : null;

  // Open company ideas you haven't voted on. Auto-promote needs EVERYONE with
  // Work access to upvote, so one person forgetting parks an idea forever —
  // this is the only prompt that exists. Deliberately a count on the dashboard
  // and NOT a notification: a recurring "you haven't voted" ping is how people
  // learn to ignore notifications entirely.
  const voteAttention = canAccess(ctx, "work")
    ? (async () => {
        const [open, mine] = await Promise.all([
          rowsOrThrow(
            ctx.supabase
              .from("ideas")
              .select("id")
              .eq("is_demo", ctx.showcase)
              .eq("status", "open")
              .is("project_id", null),
            "open ideas"
          ),
          rowsOrThrow(
            ctx.supabase
              .from("idea_votes")
              .select("idea_id")
              .eq("user_id", ctx.userId),
            "my idea votes"
          ),
        ]);
        const voted = new Set(mine.map((v) => v.idea_id));
        return open.filter((i) => !voted.has(i.id)).length;
      })()
    : null;

  const workStats = canAccess(ctx, "work")
    ? Promise.all([
        selectOrThrow(
          ctx.supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("is_demo", ctx.showcase)
            .eq("status", "active"),
          "active projects count"
        ),
        selectOrThrow(
          ctx.supabase
            .from("ideas")
            .select("id", { count: "exact", head: true })
            .eq("is_demo", ctx.showcase)
            .eq("status", "open"),
          "open ideas count"
        ),
      ])
    : null;

  const learnStats = canAccess(ctx, "learn")
    ? (() => {
        const today = todayInIstanbul();
        return selectOrThrow(
          ctx.supabase
            .from("sprints")
            .select("id", { count: "exact", head: true })
            .eq("is_demo", ctx.showcase)
            .lte("starts_on", today)
            .gte("ends_on", today),
          "active sprints count"
        );
      })()
    : null;

  const managementStats = canAccess(ctx, "management")
    ? Promise.all([
        selectOrThrow(
          ctx.supabase
            .from("recurring_items")
            .select("*")
            .eq("is_demo", ctx.showcase)
            .is("canceled_on", null),
          "recurring_items"
        ),
        selectOrThrow(
          ctx.supabase.from("fx_rates").select("currency, rate_to_try"),
          "fx_rates"
        ),
      ])
    : null;

  const marketingStats = canAccess(ctx, "marketing")
    ? selectOrThrow(
        ctx.supabase
          .from("marketing_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", ctx.showcase)
          .eq("status", "running"),
        "running campaigns count"
      )
    : null;

  const commsStats = canAccess(ctx, "comms")
    ? Promise.all([
        selectOrThrow(
          ctx.supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("is_demo", ctx.showcase)
            .eq("kind", "lead"),
          "leads count"
        ),
        selectOrThrow(
          ctx.supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("is_demo", ctx.showcase)
            .eq("kind", "client"),
          "clients count"
        ),
      ])
    : null;

  const [
    attentionRes,
    learnAttentionRes,
    reminderAttentionRes,
    contractAttentionRes,
    voteAttentionRes,
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
    learnAttention,
    reminderAttention,
    contractAttention,
    voteAttention,
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
      : rowsOrThrow(
          ctx.supabase
            .from("reminders")
            .select("*")
            .order("done", { ascending: true })
            .order("created_at", { ascending: false }),
          "reminders"
        ),
    ctx.showcase
      ? null
      : rowsOrThrow(
          ctx.supabase
            .from("announcements")
            .select("*")
            .eq("active", true)
            .order("created_at", { ascending: false })
            .limit(1),
          "announcements"
        ),
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
  const goalsLeft = learnAttentionRes?.left ?? 0;
  const dueReminders = reminderAttentionRes?.count ?? 0;
  const expiringContracts = contractAttentionRes?.count ?? 0;
  const unvotedIdeas = voteAttentionRes ?? 0;
  // The strip renders only when it has something to say. A permanent bar
  // reading all zeros is furniture, not an answer to "what needs me".
  const needsYou =
    overdueCount > 0 ||
    suggestedCount > 0 ||
    goalsLeft > 0 ||
    dueReminders > 0 ||
    expiringContracts > 0 ||
    unvotedIdeas > 0;

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

  // Both are null in showcase mode (deliberately skipped), else a real array.
  const reminders = (remindersRes ?? []) as Reminder[];
  const announcement = ((annRes ?? []) as Announcement[])[0] ?? null;

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
      {needsYou && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
            Needs you
          </span>
          {overdueCount > 0 && (
            <Link
              // ⚠️ Was `?preset=mine&sort=deadline` — but there is no `preset`
              // param. The board reads `b`/`s`/`p`/`k`/`a`/`q`/`sort`
              // (lib/use-board-filters.ts), so the old link silently landed on
              // an unfiltered board: the one deep-link the app had, filtering
              // nothing. `a` is the assignee filter (an array param, so a single
              // id is valid).
              href={`/debug?a=${ctx.userId}&sort=deadline`}
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
          {dueReminders > 0 && (
            <Link
              href="/#reminders"
              className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-[13px] text-danger transition-colors duration-150 hover:bg-danger/15"
            >
              <span className="font-mono font-medium">{dueReminders}</span>
              reminder{dueReminders === 1 ? "" : "s"} due
            </Link>
          )}
          {goalsLeft > 0 && learnAttentionRes && (
            <Link
              href={`/learn/${learnAttentionRes.sprintId}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:border-line-strong hover:bg-raised hover:text-ink"
            >
              <span className="font-mono font-medium text-ink">{goalsLeft}</span>
              goal{goalsLeft === 1 ? "" : "s"} to tick
            </Link>
          )}
          {unvotedIdeas > 0 && (
            <Link
              href="/work?tab=ideas"
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:border-line-strong hover:bg-raised hover:text-ink"
            >
              <span className="font-mono font-medium text-ink">
                {unvotedIdeas}
              </span>
              need{unvotedIdeas === 1 ? "s" : ""} your vote
            </Link>
          )}
          {expiringContracts > 0 && (
            <Link
              href="/management/finance?tab=contracts"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber/30 bg-amber/10 px-2 py-1 text-[13px] text-amber transition-colors duration-150 hover:bg-amber/15"
            >
              <span className="font-mono font-medium">{expiringContracts}</span>
              contract{expiringContracts === 1 ? "" : "s"} ending
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
        <div
          className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-[repeat(var(--stat-cols),minmax(0,1fr))]"
          style={{
            // The column count FOLLOWS the data. Hardcoding six left a member
            // who can't reach every section staring at empty cells — bare gap
            // color in the shape of a tile, which announces "something is
            // hidden from you". Membership is invisible until it matters.
            "--stat-cols": Math.min(stats.length, 6),
          } as CSSProperties}
        >
          {stats.map((s, i) => (
            <Link
              key={s.section}
              href={s.href}
              className={cn(
                "group bg-surface p-3 transition-colors duration-150 hover:bg-raised",
                // The narrow breakpoints have fixed column counts, so a stat
                // count that doesn't divide evenly leaves a hole at the end of
                // the last row — the same tell as above, just narrower. The
                // first tile absorbs the remainder so every row ends flush.
                stats.length % 2 === 1 && i === 0 && "col-span-2 sm:col-span-1",
                stats.length % 3 === 1 && i === 0 && "sm:col-span-3 lg:col-span-1",
                stats.length % 3 === 2 && i === 0 && "sm:col-span-2 lg:col-span-1"
              )}
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
