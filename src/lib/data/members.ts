import { cache } from "react";
import { memberColorCss } from "@/lib/colors";
import type { RosterPerson } from "@/lib/pinboard";
import type { MembersMap } from "@/lib/types";
import { getSessionContext, type SessionContext } from "@/lib/data/session";
import { rowsOrThrow } from "@/lib/data/query";

/**
 * A stable, non-identifying display name for a real person while showcasing.
 * Deterministic on the profile id, so the SAME teammate reads as the same
 * "Team member" everywhere within a demo — but their real name and (crucially)
 * their real email never reach the client. Colors are kept: they're not
 * identifying and preserve the app's color-coding so the demo still looks alive.
 */
export function demoName(id: string) {
  // A short stable suffix from the id — enough to tell two teammates apart in a
  // demo without revealing who they are.
  return `Team member ${id.slice(0, 4).toUpperCase()}`;
}

/**
 * Everyone's display name + identity color, for color-coding names app-wide.
 *
 * Wrapped in React cache() because the layout AND the page both need it on
 * nearly every navigation — without this it runs the same profiles query twice
 * per request, and each one is a full round-trip to the database. Deduped, the
 * second call is free. The cache is per-request, so edits still show instantly.
 *
 * SHOWCASE: real names AND emails are personal data that must never reach a
 * client being demoed to. `profiles` has no is_demo column, so the usual demo
 * filter can't help here — instead, in showcase mode every member is mapped to
 * a synthetic "Team member ####" label with no email. This is the fix for the
 * leak where demo rows (or presence/activity) resolved authors through real
 * identities. Showcase state comes from the request's session context
 * (cache()-deduped, already loaded), so callers don't have to thread it in.
 */
export const getMembersMap = cache(async function getMembersMap(
  supabase: SessionContext["supabase"]
): Promise<MembersMap> {
  const [data, ctx] = await Promise.all([
    rowsOrThrow(
      // ⚠️ kind = 'member' (0062). This map is the app's answer to "who is a
      // person here" — it colours every author line, fills the @-mention list,
      // and names notification actors. Client accounts are logins, not
      // colleagues; without this filter one appears in the mention menu of a
      // chat they cannot see, next to the eight people who can.
      supabase.from("profiles").select("id, full_name, email, color").eq("kind", "member"),
      "members: profiles"
    ),
    getSessionContext(),
  ]);

  const map: MembersMap = {};
  for (const p of data) {
    map[p.id] = {
      name: ctx.showcase ? demoName(p.id) : p.full_name || p.email,
      color: memberColorCss(p.id, p.color),
    };
  }
  return map;
});

/**
 * The roster behind the pinboard composer's "who will see this" preview: every
 * member, plus the two membership facts the audience rules turn on.
 *
 * ⚠️ ADMIN-ONLY DATA. This is the one place the app hands a browser a picture
 * of who belongs to what, so the CALLER must gate it on ctx.isAdmin and pass
 * null otherwise — props reach the client for every user who renders the
 * component, not only the ones who can see the composer. Showcase returns empty
 * for the same reason getMembersMap anonymises there: the pinboard is hidden in
 * showcase anyway, and a roster is exactly what must not reach a demo guest.
 */
export async function getAudienceRoster(
  ctx: SessionContext
): Promise<RosterPerson[]> {
  if (!ctx.isAdmin || ctx.showcase) return [];

  const [people, memberships] = await Promise.all([
    rowsOrThrow(
      ctx.supabase
        .from("profiles")
        .select("id, full_name, email, color, is_admin")
        .eq("kind", "member"),
      "audience roster: profiles"
    ),
    rowsOrThrow(
      // Only the two sections the four audiences are defined in terms of. The
      // rest would be roster detail the preview never consults.
      ctx.supabase
        .from("section_memberships")
        .select("user_id, section")
        .in("section", ["work", "learn"]),
      "audience roster: memberships"
    ),
  ]);

  const work = new Set<string>();
  const learn = new Set<string>();
  for (const m of memberships) {
    (m.section === "work" ? work : learn).add(m.user_id);
  }

  return people
    .map((p) => ({
      id: p.id,
      name: p.full_name || p.email,
      color: memberColorCss(p.id, p.color),
      isAdmin: Boolean(p.is_admin),
      hasWork: work.has(p.id),
      hasLearn: learn.has(p.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
