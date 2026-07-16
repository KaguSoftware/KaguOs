import { canAccess, type SessionContext } from "@/lib/data/session";

export type ActivityKind =
  | "debug_task"
  | "idea"
  | "project"
  | "transaction"
  | "post";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  href: string;
  at: string; // ISO timestamp
  actorId: string | null;
};

const PER_SOURCE = 6;

/**
 * A unified, membership-gated recent-activity stream. Each source is queried
 * only when the user can reach that section (RLS gates it a second time), each
 * capped small; results are merged and sorted newest-first in one place. One
 * parallel fan-out, no UNION view to maintain.
 */
export async function getActivity(
  ctx: SessionContext,
  limit = 12
): Promise<ActivityItem[]> {
  const sb = ctx.supabase;
  const jobs: Promise<ActivityItem[]>[] = [];

  if (canAccess(ctx, "debug")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("debug_tasks")
          .select("id, title, created_at, created_by")
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

  const merged = (await Promise.all(jobs)).flat();
  merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return merged.slice(0, limit);
}
