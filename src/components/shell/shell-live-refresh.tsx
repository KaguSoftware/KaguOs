"use client";

import { useCallback } from "react";
import { LiveRefresh } from "@/components/shell/live-refresh";
import type { ChangePayload } from "@/lib/use-realtime-refresh";

/**
 * The shell's app-wide subscription: the notification bell and the sidebar's
 * presence rail both come from a server re-render, so something has to watch
 * `notifications` and `profiles` from every page.
 *
 * THE PROBLEM THIS SOLVES. This was a bare
 * `<LiveRefresh tables={["notifications", "profiles"]} />`, which meant
 * `event: "*"` on `profiles` with no filter. data/session.ts stamps
 * `last_seen_at` on every active user at most once per 5 minutes — a tiny write,
 * deliberately thrown off the critical path with after(). But it is still a
 * `profiles` UPDATE, so it reached every open tab of every teammate and fired a
 * full `router.refresh()` of the app shell: the layout's entire query wave
 * (getPresence + getInboxSummary + the members map + notifications) plus the RSC
 * payload, round-tripped to hnd1. Nothing on screen changed. The cost was
 * users x tabs every 5 minutes and grew quadratically with the team.
 *
 * It bought nothing, because `last_seen_at` is only ever the STALE FALLBACK for
 * presence — shell/sidebar.tsx reads it solely when the presence channel has no
 * live entry for someone, and sidebar-presence.tsx renders it as "Last seen 20m
 * ago" prose. The presence:team channel (lib/use-live-presence.ts) already
 * reports the truth the instant a tab opens or closes, with no row write at all.
 * Refreshing the world to hurry along a value that exists only for when the
 * realtime answer is missing is backwards.
 *
 * So the events are filtered rather than the subscription — the same shape as
 * chat-live-refresh.tsx, and for the same reason. Dropping `profiles` wholesale
 * would be wrong in the other direction: status_kind, status_emoji, status_text,
 * available_to_call, status_until, full_name and color are all server-rendered
 * in the sidebar and must still repaint the moment a teammate changes one.
 *
 * The diff is possible at all because 0029_realtime_everywhere.sql sets
 * `replica identity full` on every published table, so an UPDATE payload carries
 * the complete old row and not just the primary key.
 */

/** The one column whose change is, on its own, not worth a server round trip. */
const HEARTBEAT_ONLY = "last_seen_at";

export function ShellLiveRefresh({ meId }: { meId: string }) {
  const shouldRefresh = useCallback((payload: ChangePayload) => {
    if (payload.table !== "profiles" || payload.eventType !== "UPDATE")
      return true;

    const before = payload.old as Record<string, unknown> | undefined;
    const after = payload.new as Record<string, unknown> | undefined;
    // Without a full old row there is nothing to compare, so assume it matters.
    // (Belt and braces: replica identity full means this shouldn't happen.)
    if (!before || !after || Object.keys(before).length === 0) return true;

    // Refresh as soon as ANY column other than the heartbeat moved. Iterating
    // the union of both key sets catches a column appearing or vanishing across
    // a deploy, not just a value changing.
    // Identity comparison is enough because every profiles column is a scalar
    // (text / boolean / timestamptz / uuid). If one ever becomes an array or
    // jsonb, the payload deserializes to a fresh object each time and this
    // would compare unequal forever — silently turning the filter back off
    // rather than breaking loudly. Compare that column by value if it happens.
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (key === HEARTBEAT_ONLY) continue;
      if (!Object.is(before[key], after[key])) return true;
    }
    return false;
  }, []);

  return (
    <LiveRefresh
      tables={[
        // The notifications RLS policy is already `recipient_id = auth.uid()`,
        // so nobody else's rows ever reached this client — the filter is NOT a
        // privacy or bandwidth change. It is a cheap short-circuit: Realtime
        // applies the filter before running the per-subscriber RLS check, which
        // is the part that actually costs it CPU as the team grows.
        { table: "notifications", filter: `recipient_id=eq.${meId}` },
        "profiles",
      ]}
      shouldRefresh={shouldRefresh}
    />
  );
}
