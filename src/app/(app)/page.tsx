import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { getSessionContext, canAccess } from "@/lib/data/session";
import { getMembersMap } from "@/lib/data/members";
import { getActivity } from "@/lib/data/activity";
import { PageHeader } from "@/components/shell/page-header";
import { Reminders } from "@/components/shell/reminders";
import { ActivityFeed } from "@/components/shell/activity-feed";
import { AnnouncementHero } from "@/components/shell/announcement-hero";
import { formatTRY, isActiveRecurring, monthlyAmount, toTRY, type FxRates } from "@/lib/finance";
import { SECTION_LABELS, type Announcement, type Reminder, type Section } from "@/lib/types";

type Card = { section: Section; href: string; blurb: string; stat?: string };
type QuickAction = { label: string; href: string };

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const firstName = ctx.profile.full_name?.split(" ")[0] ?? ctx.profile.email;

  const cards: Card[] = [];
  let myTasks = 0;

  if (canAccess(ctx, "debug")) {
    const [{ count: open }, { count: mine }] = await Promise.all([
      ctx.supabase
        .from("debug_tasks")
        .select("id", { count: "exact", head: true })
        .eq("state", "open"),
      ctx.supabase
        .from("debug_tasks")
        .select("id", { count: "exact", head: true })
        .eq("assignee_id", ctx.userId)
        .neq("state", "done"),
    ]);
    myTasks = mine ?? 0;
    cards.push({
      section: "debug",
      href: "/debug",
      blurb: "See what's left, claim what you want.",
      stat: `${open ?? 0} open · ${mine ?? 0} yours`,
    });
  }

  if (canAccess(ctx, "work")) {
    const [{ count: active }, { count: ideas }] = await Promise.all([
      ctx.supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      ctx.supabase
        .from("ideas")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
    ]);
    cards.push({
      section: "work",
      href: "/work",
      blurb: "Projects and the ideas board.",
      stat: `${active ?? 0} active projects · ${ideas ?? 0} open ideas`,
    });
  }

  if (canAccess(ctx, "learn")) {
    const today = new Date().toISOString().slice(0, 10);
    const { count: active } = await ctx.supabase
      .from("sprints")
      .select("id", { count: "exact", head: true })
      .lte("starts_on", today)
      .gte("ends_on", today);
    cards.push({
      section: "learn",
      href: "/learn",
      blurb: "Learning sprints and your progress.",
      stat: `${active ?? 0} active ${active === 1 ? "sprint" : "sprints"}`,
    });
  }

  if (canAccess(ctx, "management")) {
    const [{ data: recurring }, { data: fx }] = await Promise.all([
      ctx.supabase.from("recurring_items").select("*").is("canceled_on", null),
      ctx.supabase.from("fx_rates").select("currency, rate_to_try"),
    ]);
    const rates: FxRates = {};
    for (const r of fx ?? []) rates[r.currency as "USD" | "EUR"] = Number(r.rate_to_try);
    let net = 0;
    for (const item of (recurring ?? []).filter(isActiveRecurring)) {
      const v = toTRY(monthlyAmount(item), item.currency, rates);
      if (v !== null) net += item.type === "income" ? v : -v;
    }
    cards.push({
      section: "management",
      href: "/management/finance",
      blurb: "Ledger, subscriptions, contracts.",
      stat: `recurring ${net >= 0 ? "+" : ""}${formatTRY(net)}/mo`,
    });
  }

  if (canAccess(ctx, "marketing")) {
    const { count: running } = await ctx.supabase
      .from("marketing_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("status", "running");
    cards.push({
      section: "marketing",
      href: "/marketing",
      blurb: "Campaigns, content calendar, links.",
      stat: `${running ?? 0} running ${running === 1 ? "campaign" : "campaigns"}`,
    });
  }

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
  if (ctx.isAdmin)
    actions.push({ label: "New sprint", href: "/learn/new" });

  const [activity, members, { data: reminderRows }, { data: annRows }] =
    await Promise.all([
      getActivity(ctx),
      getMembersMap(ctx.supabase),
      ctx.supabase
        .from("reminders")
        .select("*")
        .order("done", { ascending: true })
        .order("created_at", { ascending: false }),
      ctx.supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
  const reminders = (reminderRows ?? []) as Reminder[];
  const announcement = ((annRows ?? []) as Announcement[])[0] ?? null;

  return (
    <>
      <PageHeader
        title={`Hey, ${firstName}`}
        description={
          canAccess(ctx, "debug") && myTasks > 0
            ? `You have ${myTasks} debug ${myTasks === 1 ? "task" : "tasks"} on your plate.`
            : "Everything Kagu runs on, in one quiet place."
        }
      />
      <AnnouncementHero announcement={announcement} isAdmin={ctx.isAdmin} />
      {actions.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors duration-150 hover:border-primary/40 hover:bg-raised hover:text-ink"
            >
              <Plus className="size-3.5 text-faint" aria-hidden />
              {action.label}
            </Link>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:content-start">
          {cards.map((card) => (
            <Link
              key={card.section}
              href={card.href}
              className="group rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-raised"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{SECTION_LABELS[card.section]}</h2>
                <ArrowUpRight
                  className="size-4 text-faint transition-colors duration-150 group-hover:text-primary-dim"
                  aria-hidden
                />
              </div>
              <p className="mt-1 text-[13px] text-muted">{card.blurb}</p>
              {card.stat && (
                <p className="mt-2 font-mono text-xs text-primary-dim/90">{card.stat}</p>
              )}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-6">
          <ActivityFeed items={activity} members={members} />
          <Reminders reminders={reminders} members={members} meId={ctx.userId} />
        </div>
      </div>
    </>
  );
}
