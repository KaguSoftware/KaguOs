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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("section_memberships").select("section").eq("user_id", user.id),
  ]);
  if (!profile) redirect("/login");

  const sections = new Set<Section>(
    (memberships ?? []).map((m) => m.section as Section)
  );

  return {
    supabase,
    userId: user.id,
    profile: profile as Profile,
    sections,
    isAdmin: (profile as Profile).is_admin,
    showcase: Boolean((profile as Profile).showcase_mode),
  };
});

export function canAccess(ctx: SessionContext, section: Section) {
  return ctx.isAdmin || ctx.sections.has(section);
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
