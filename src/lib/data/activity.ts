import { canAccess, type SessionContext } from "@/lib/data/session";

export type ActivityKind =
  | "debug_task"
  | "idea"
  | "project"
  | "transaction"
  | "post"
  | "meeting"
  | "contact";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  href: string;
  at: string; // ISO timestamp
  actorId: string | null;
};

// Per source, not per feed: each stream contributes this many rows and the
// merge takes the newest `limit` overall. Raised from 6 so the feed can filter
// by kind client-side and still have something to show — filtering 12 mixed
// rows down to one kind used to leave two or three.
const PER_SOURCE = 15;

/**
 * A unified, membership-gated recent-activity stream. Each source is queried
 * only when the user can reach that section (RLS gates it a second time), each
 * capped small; results are merged and sorted newest-first in one place. One
 * parallel fan-out, no UNION view to maintain.
 */
export async function getActivity(
  ctx: SessionContext,
  limit = 40
): Promise<ActivityItem[]> {
  const sb = ctx.supabase;
  const jobs: Promise<ActivityItem[]>[] = [];

  if (canAccess(ctx, "debug")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("debug_tasks")
          .select("id, title, created_at, created_by")
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE);
        return (data ?? []).map((r) => ({
          id: `debug_task:${r.id}`,
          kind: "debug_task" as const,
          title: r.title,
          href: "/debug",
          at: r.created_at,
          actorId: r.created_by,
        }));
      })()
    );
  }

  if (canAccess(ctx, "work")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("ideas")
          .select("id, title, created_at, created_by")
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE);
        return (data ?? []).map((r) => ({
          id: `idea:${r.id}`,
          kind: "idea" as const,
          title: r.title,
          href: `/work/ideas/${r.id}`,
          at: r.created_at,
          actorId: r.created_by,
        }));
      })()
    );
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("projects")
          .select("id, name, created_at, created_by")
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE);
        return (data ?? []).map((r) => ({
          id: `project:${r.id}`,
          kind: "project" as const,
          title: r.name,
          href: `/work/projects/${r.id}`,
          at: r.created_at,
          actorId: r.created_by,
        }));
      })()
    );
  }

  if (canAccess(ctx, "management")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("transactions")
          .select("id, type, amount, currency, created_at, created_by")
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE);
        return (data ?? []).map((r) => ({
          id: `transaction:${r.id}`,
          kind: "transaction" as const,
          title: `${r.type === "income" ? "Income" : "Expense"} · ${r.amount} ${r.currency}`,
          href: `/management/finance/transactions/${r.id}`,
          at: r.created_at,
          actorId: r.created_by,
        }));
      })()
    );
  }

  if (canAccess(ctx, "marketing")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("marketing_posts")
          .select("id, title, created_at, created_by")
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE);
        return (data ?? []).map((r) => ({
          id: `post:${r.id}`,
          kind: "post" as const,
          title: r.title,
          href: "/marketing?tab=content",
          at: r.created_at,
          actorId: r.created_by,
        }));
      })()
    );
  }

  if (canAccess(ctx, "comms")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("comms_meetings")
          .select("id, title, created_at, created_by")
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE);
        return (data ?? []).map((r) => ({
          id: `meeting:${r.id}`,
          kind: "meeting" as const,
          title: r.title,
          href: "/comms",
          at: r.created_at,
          actorId: r.created_by,
        }));
      })()
    );
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("contacts")
          .select("id, name, created_at, created_by")
          .eq("is_demo", ctx.showcase)
          .order("created_at", { ascending: false })
          .limit(PER_SOURCE);
        return (data ?? []).map((r) => ({
          id: `contact:${r.id}`,
          kind: "contact" as const,
          title: r.name,
          href: `/comms/${r.id}`,
          at: r.created_at,
          actorId: r.created_by,
        }));
      })()
    );
  }

  const merged = (await Promise.all(jobs)).flat();
  merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return merged.slice(0, limit);
}
