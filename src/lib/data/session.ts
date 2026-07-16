import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Section } from "@/lib/types";

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

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("section_memberships").select("section").eq("user_id", userId),
  ]);
  if (!profile) redirect("/login");

  const sections = new Set<Section>(
    (memberships ?? []).map((m) => m.section as Section)
  );

  return {
    supabase,
    userId,
    profile: profile as Profile,
    sections,
    isAdmin: (profile as Profile).is_admin,
    showcase: Boolean((profile as Profile).showcase_mode),
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

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx.isAdmin) redirect("/");
  return ctx;
}
