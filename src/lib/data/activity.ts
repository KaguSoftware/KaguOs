import { canAccess, type SessionContext } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";

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
        const data = await rowsOrThrow(
          sb
            .from("debug_tasks")
            .select("id, title, created_at, created_by")
            .eq("is_demo", ctx.showcase)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          "activity: debug_tasks"
        );
        return data.map((r) => ({
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
        const data = await rowsOrThrow(
          sb
            .from("ideas")
            .select("id, title, created_at, created_by")
            .eq("is_demo", ctx.showcase)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          "activity: ideas"
        );
        return data.map((r) => ({
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
        const data = await rowsOrThrow(
          sb
            .from("projects")
            .select("id, name, created_at, created_by")
            .eq("is_demo", ctx.showcase)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          "activity: projects"
        );
        return data.map((r) => ({
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
        const data = await rowsOrThrow(
          sb
            .from("transactions")
            .select("id, type, amount, currency, created_at, created_by")
            .eq("is_demo", ctx.showcase)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          "activity: transactions"
        );
        return data.map((r) => ({
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
        const data = await rowsOrThrow(
          sb
            .from("marketing_posts")
            .select("id, title, created_at, created_by")
            .eq("is_demo", ctx.showcase)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          "activity: marketing_posts"
        );
        return data.map((r) => ({
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
        const data = await rowsOrThrow(
          sb
            .from("comms_meetings")
            .select("id, title, created_at, created_by")
            .eq("is_demo", ctx.showcase)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          "activity: comms_meetings"
        );
        return data.map((r) => ({
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
        const data = await rowsOrThrow(
          sb
            .from("contacts")
            .select("id, name, created_at, created_by")
            .eq("is_demo", ctx.showcase)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
          "activity: contacts"
        );
        return data.map((r) => ({
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

  // ⚠️ allSettled, NOT all — and this is a deliberate exception to the
  // "a failed query must be loud" rule that governs the rest of the app.
  //
  // The feed is a SECONDARY widget on a dashboard whose primary job is the stat
  // row and the "needs you" strip. Letting one broken source (say, marketing)
  // throw would blank the entire dashboard — trading a partial feed for no
  // dashboard at all, which is a worse outcome than the bug being fixed.
  //
  // So a failing source drops out of the feed but is logged with its reason, so
  // it still shows up in the server logs instead of vanishing the way the old
  // `data ?? []` did. Silence is the thing being fixed here, not the fallback.
  const settled = await Promise.allSettled(jobs);
  const merged: ActivityItem[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") merged.push(...result.value);
    else console.error("activity feed source failed:", result.reason);
  }
  merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return merged.slice(0, limit);
}
