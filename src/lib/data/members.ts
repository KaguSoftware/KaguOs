import { cache } from "react";
import { memberColorCss } from "@/lib/colors";
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
      supabase.from("profiles").select("id, full_name, email, color"),
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
