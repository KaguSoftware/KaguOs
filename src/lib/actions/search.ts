"use server";

import { canAccess, demoFlag, getSessionContext } from "@/lib/data/session";

/** One searchable thing surfaced in the ⌘K palette. */
export type SearchHit = {
  id: string;
  type: "task" | "project" | "idea" | "contact" | "sprint";
  label: string;
  /** Secondary line (project name, company, client…). */
  sub?: string;
  href: string;
};

// Safety cap per type. At today's data size (dozens of rows) this never bites;
// it's a backstop so the palette payload can't balloon if a table grows huge.
// If a type is capped, the newest rows win (the query orders by recency).
const PER_TYPE_CAP = 200;

/**
 * Everything the ⌘K palette can jump to, for the sections this user can see.
 * Called ONCE when the palette first opens (the client caches it), so this is
 * one wave of small queries, not a per-keystroke round-trip — filtering happens
 * in the browser. Respects section access + showcase mode exactly like the
 * section pages do.
 */
export async function searchContent(): Promise<SearchHit[]> {
  const ctx = await getSessionContext();
  const demo = demoFlag(ctx);
  const hits: SearchHit[] = [];

  // Fire every permitted query in ONE wave — the cost is trips, not queries.
  const [tasks, projects, ideas, contacts, sprints] = await Promise.all([
    canAccess(ctx, "debug")
      ? ctx.supabase
          .from("debug_tasks")
          .select("id, title, project_id")
          .eq("is_demo", demo)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(PER_TYPE_CAP)
      : null,
    canAccess(ctx, "work")
      ? ctx.supabase
          .from("projects")
          .select("id, name, client")
          .eq("is_demo", demo)
          .order("updated_at", { ascending: false })
          .limit(PER_TYPE_CAP)
      : null,
    canAccess(ctx, "work")
      ? ctx.supabase
          .from("ideas")
          .select("id, title")
          .eq("is_demo", demo)
          .order("created_at", { ascending: false })
          .limit(PER_TYPE_CAP)
      : null,
    canAccess(ctx, "comms")
      ? ctx.supabase
          .from("contacts")
          .select("id, name, company")
          .eq("is_demo", demo)
          .order("updated_at", { ascending: false })
          .limit(PER_TYPE_CAP)
      : null,
    canAccess(ctx, "learn")
      ? ctx.supabase
          .from("sprints")
          .select("id, title")
          .eq("is_demo", demo)
          .order("starts_on", { ascending: false })
          .limit(PER_TYPE_CAP)
      : null,
  ]);

  // Debug tasks: the board has no per-task route, so link to /debug and carry the
  // project name as the sub-label (resolved from the projects we just fetched).
  const projectName = new Map(
    (projects?.data ?? []).map((p) => [p.id, p.name])
  );
  for (const t of tasks?.data ?? []) {
    hits.push({
      id: t.id,
      type: "task",
      label: t.title,
      sub: t.project_id ? projectName.get(t.project_id) : undefined,
      href: "/debug",
    });
  }
  for (const p of projects?.data ?? []) {
    hits.push({
      id: p.id,
      type: "project",
      label: p.name,
      sub: p.client ?? undefined,
      href: `/work/projects/${p.id}`,
    });
  }
  for (const i of ideas?.data ?? []) {
    hits.push({ id: i.id, type: "idea", label: i.title, href: `/work/ideas/${i.id}` });
  }
  for (const c of contacts?.data ?? []) {
    hits.push({
      id: c.id,
      type: "contact",
      label: c.name,
      sub: c.company ?? undefined,
      href: `/comms/${c.id}`,
    });
  }
  for (const s of sprints?.data ?? []) {
    hits.push({ id: s.id, type: "sprint", label: s.title, href: `/learn/${s.id}` });
  }

  return hits;
}
