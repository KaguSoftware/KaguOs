import { cache } from "react";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SECTION_LABELS, type Profile, type Section } from "@/lib/types";

/**
 * How much a membership lets you do. 'write' is the default and the only thing
 * that existed before 0053 — a 'read' member sees the section and can change
 * nothing in it.
 */
export type SectionAccess = "read" | "write";

/** How stale last_seen_at must be before we bother writing a fresh one. */
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export type SessionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: Profile;
  /** Sections you can SEE. Membership alone; says nothing about writing. */
  sections: Set<Section>;
  /**
   * Per-section write tier. Kept alongside `sections` rather than folded into
   * it: canAccess() has 40+ call sites, and a single Map would make "can read"
   * and "can write" look identical at every one of them — when the whole point
   * of the tier is that those two questions must stay visibly different.
   */
  access: Map<Section, SectionAccess>;
  isAdmin: boolean;
  /** When true, the app shows obviously-fake demo data (client showcase). */
  showcase: boolean;
};

/**
 * Loads the signed-in user's profile + memberships; redirects to /login if
 * signed out. Wrapped in React cache() so layout + page share one lookup per
 * request instead of hitting the database twice.
 */
export const getSessionContext = cache(async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();

  // getClaims() verifies the JWT LOCALLY against the project's ES256 JWKS —
  // no auth-server round-trip (unlike getUser(), which costs a full ~300ms
  // network call). The proxy already refreshed the token on this request, so
  // the claims are fresh. If the project ever reverts to a legacy HS256 shared
  // secret, getClaims() would fall back to a network call — still correct.
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  // One RPC, not two queries. The profile and the memberships are always needed
  // together and always gate the rest of the page, so they're fetched in a
  // single trip (see 0017_session_context_rpc.sql). The database answers in
  // microseconds; what costs ~305ms is the flight to it — so trips, not query
  // count, are what to optimise. The function reads auth.uid() internally, so
  // there's no id to pass and nothing for a client to tamper with.
  //
  // ⚠️ Deliberately NOT wrapped in selectOrThrow. This is the one place where a
  // failed read must NOT throw: a missing/failed session means "signed out", and
  // the correct response is the redirect below, not an error screen. Throwing
  // here would turn an expired token into a crash on every route, including the
  // path out to /login.
  const { data: row } = await supabase.rpc("session_context");
  const ctx = row as {
    profile: Profile;
    sections: Section[];
    // Optional so a stale RPC (migration not yet applied, or a rollback) can't
    // lock the whole company out — see the permissive default in canWrite.
    access?: Record<Section, SectionAccess>;
  } | null;
  if (!ctx?.profile) redirect("/login");

  const profile = ctx.profile;
  const sections = new Set<Section>(ctx.sections ?? []);
  const access = new Map<Section, SectionAccess>(
    Object.entries(ctx.access ?? {}) as [Section, SectionAccess][]
  );

  // Stamp "last seen", throttled + off the critical path. Only write when the
  // stored value is missing or older than the throttle window, so an active user
  // costs at most one tiny update every 5 min, not one per page. after() runs it
  // once the response has shipped — it never delays the page.
  const lastSeen = profile.last_seen_at ? Date.parse(profile.last_seen_at) : 0;
  if (Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
    after(async () => {
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", userId);
    });
  }

  return {
    supabase,
    userId,
    profile,
    sections,
    access,
    isAdmin: profile.is_admin,
    showcase: Boolean(profile.showcase_mode),
  };
});

export function canAccess(ctx: SessionContext, section: Section) {
  // In showcase mode everyone can roam every section — it's all demo data, so
  // there's nothing real to protect and the point is to show the whole app off.
  return ctx.isAdmin || ctx.showcase || ctx.sections.has(section);
}

/**
 * Can this user CHANGE things in the section — the write half of canAccess.
 *
 * Mirrors private.can_write() in the database (0053), which is where the rule is
 * actually enforced; this exists so the UI can hide affordances that would fail,
 * and so actions can return a sentence instead of an RLS error.
 *
 * The `?? "write"` default is deliberate and permissive: if the access map is
 * empty because the RPC predates 0053, every member behaves exactly as they did
 * before the tier existed. Failing the other way would lock the company out of
 * writing during a deploy window.
 */
export function canWrite(ctx: SessionContext, section: Section) {
  // Showcase roams everywhere and writes nowhere — it must not gain a write
  // path here that blockIfShowcase would otherwise have stopped.
  if (ctx.showcase) return false;
  if (ctx.isAdmin) return true;
  if (!ctx.sections.has(section)) return false;
  return (ctx.access.get(section) ?? "write") === "write";
}

/**
 * The signed-in user's id from the LOCAL JWT (getClaims → ES256 verify, no
 * network). Use this in lightweight actions that only need the id and don't
 * want the full session-context fetch. Returns null when signed out.
 */
export async function getUserId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { data: claims } = await supabase.auth.getClaims();
  return claims?.claims.sub ?? null;
}

/**
 * The `is_demo` value every list query should filter by. In showcase mode the
 * app shows ONLY demo rows; normally it shows ONLY real rows. Apply this in the
 * data layer so real data never reaches a client that's demoing.
 *
 *   ctx.supabase.from("projects").select("*").eq("is_demo", demoFlag(ctx))
 */
export function demoFlag(ctx: SessionContext): boolean {
  return ctx.showcase;
}

/** Page guard: members (or admins) only — everyone else lands back on the dashboard. */
export async function requireSection(section: Section): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!canAccess(ctx, section)) redirect("/");
  return ctx;
}

/**
 * Showcase mode is a read-only tour: while it's on, the user roams every
 * section (see canAccess) but must not mutate anything — writing would create
 * real rows in sections they don't belong to, or pollute the demo set. Mutating
 * server actions call this first and return its result when it's non-null.
 *
 *   const stop = await blockIfShowcase(); if (stop) return stop;
 */
export async function blockIfShowcase(): Promise<{ ok: false; message: string } | null> {
  const ctx = await getSessionContext();
  return ctx.showcase
    ? { ok: false, message: "Showcase mode is read-only — exit showcase to make changes." }
    : null;
}

/**
 * The mutating-action guard for anything that belongs to a section.
 *
 * SUBSUMES blockIfShowcase — call this INSTEAD of it, not after it. Showcase is
 * just the strictest read-only case, and getSessionContext is cache()d so this
 * costs nothing extra. blockIfShowcase stays for the section-less actions
 * (account, notifications, reminders, announcements, showcase itself), which
 * have no section to check.
 *
 *   const stop = await blockIfReadOnly("debug"); if (stop) return stop;
 */
export async function blockIfReadOnly(
  section: Section
): Promise<{ ok: false; message: string } | null> {
  const ctx = await getSessionContext();
  if (ctx.showcase)
    return {
      ok: false,
      message: "Showcase mode is read-only — exit showcase to make changes.",
    };
  return canWrite(ctx, section)
    ? null
    : {
        ok: false,
        message: `You have view-only access to ${SECTION_LABELS[section]}.`,
      };
}

/**
 * Page guard for routes that exist ONLY to create or edit (/debug/new,
 * /work/projects/new, …). A view-only member shouldn't be handed a form that
 * can't submit — send them back rather than let them type into a dead end.
 */
export async function requireSectionWrite(section: Section): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!canWrite(ctx, section)) redirect("/");
  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx.isAdmin) redirect("/");
  return ctx;
}
