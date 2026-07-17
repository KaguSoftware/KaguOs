import { cache } from "react";
import { memberColorCss } from "@/lib/colors";
import type { MembersMap } from "@/lib/types";
import type { SessionContext } from "@/lib/data/session";

/**
 * Everyone's display name + identity color, for color-coding names app-wide.
 *
 * Wrapped in React cache() because the layout AND the page both need it on
 * nearly every navigation — without this it runs the same profiles query twice
 * per request, and each one is a full round-trip to the database. Deduped, the
 * second call is free. The cache is per-request, so edits still show instantly.
 */
export const getMembersMap = cache(async function getMembersMap(
  supabase: SessionContext["supabase"]
): Promise<MembersMap> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, color");

  const map: MembersMap = {};
  for (const p of data ?? []) {
    map[p.id] = {
      name: p.full_name || p.email,
      color: memberColorCss(p.id, p.color),
    };
  }
  return map;
});
