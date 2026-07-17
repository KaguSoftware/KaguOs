import { cache } from "react";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Section } from "@/lib/types";

/** How stale last_seen_at must be before we bother writing a fresh one. */
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export type SessionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: Profile;
  sections: Set<Section>;
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
  const { data: row } = await supabase.rpc("session_context");
  const ctx = row as { profile: Profile; sections: Section[] } | null;
  if (!ctx?.profile) redirect("/login");

  const profile = ctx.profile;
  const sections = new Set<Section>(ctx.sections ?? []);

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

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx.isAdmin) redirect("/");
  return ctx;
}
