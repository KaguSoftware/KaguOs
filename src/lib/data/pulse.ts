import { cache } from "react";
import { canAccess, type SessionContext } from "@/lib/data/session";
import { selectOrThrow } from "@/lib/data/query";
import { todayInIstanbul } from "@/lib/utils";
import type { Section } from "@/lib/types";

/**
 * One section's live figure, for the mobile menu's tiles.
 *
 * `weight` is what makes the menu reshape itself: a section with real work in
 * it claims more of the screen than a quiet one, so the layout reads as the
 * state of the company rather than a fixed list of destinations.
 */
export type PulseStat = {
  section: Section;
  value: number;
  /** Reads under the number: "open", "projects", "sprints". */
  label: string;
  /** How loud this tile should be. 0 = nothing going on. */
  weight: number;
};

export type Pulse = {
  stats: Partial<Record<Section, PulseStat>>;
  /** Tasks assigned to you, overdue. The one number that's about YOU. */
  overdue: number;
};

/**
 * The numbers behind the mobile menu.
 *
 * ONE parallel wave, head-only counts (no rows come back), and cache()-wrapped
 * so the layout pays for it once per request no matter who else asks. It rides
 * in the same slot as getPresence, which the layout already awaits after its
 * main wave — so this costs no extra round-trip on a navigation.
 *
 * Deliberately NOT the dashboard's numbers: that page fetches richer data
 * (recurring items, FX, activity) which would be far too heavy to run on every
 * page just to label a menu.
 */
export const getPulse = cache(async function getPulse(
  ctx: SessionContext
): Promise<Pulse> {
  const today = todayInIstanbul();
  const demo = ctx.showcase;

  // Each count throws on a failed query rather than quietly reporting 0 — a
  // menu tile showing "0 open" when the query actually failed is the same
  // silent lie the section pages used to tell.
  const count = (
    table: string,
    build: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>
  ) => selectOrThrow(build(baseQuery(table)), `pulse: ${table}`);

  function baseQuery(table: string) {
    return ctx.supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("is_demo", demo);
  }

  const jobs = {
    debug: canAccess(ctx, "debug")
      ? count("debug_tasks", (q) =>
          q.is("archived_at", null).eq("state", "open")
        )
      : null,
    overdue: canAccess(ctx, "debug")
      ? count("debug_tasks", (q) =>
          q
            .is("archived_at", null)
            .eq("assignee_id", ctx.userId)
            .neq("state", "done")
            .lt("due_on", today)
        )
      : null,
    work: canAccess(ctx, "work")
      ? count("projects", (q) => q.eq("status", "active"))
      : null,
    learn: canAccess(ctx, "learn")
      ? count("sprints", (q) => q.lte("starts_on", today).gte("ends_on", today))
      : null,
    marketing: canAccess(ctx, "marketing")
      ? count("marketing_campaigns", (q) => q.eq("status", "running"))
      : null,
    comms: canAccess(ctx, "comms")
      ? count("contacts", (q) => q.eq("kind", "lead"))
      : null,
  };

  const [debug, overdue, work, learn, marketing, comms] = await Promise.all([
    jobs.debug,
    jobs.overdue,
    jobs.work,
    jobs.learn,
    jobs.marketing,
    jobs.comms,
  ]);

  const stats: Partial<Record<Section, PulseStat>> = {};
  const put = (
    section: Section,
    res: { count: number | null } | null,
    label: string,
    singular?: string
  ) => {
    if (!res) return;
    const value = res.count ?? 0;
    stats[section] = {
      section,
      value,
      label: value === 1 && singular ? singular : label,
      weight: value,
    };
  };

  put("debug", debug, "open");
  put("work", work, "projects", "project");
  put("learn", learn, "sprints", "sprint");
  put("marketing", marketing, "campaigns", "campaign");
  put("comms", comms, "leads", "lead");

  return { stats, overdue: overdue?.count ?? 0 };
});
