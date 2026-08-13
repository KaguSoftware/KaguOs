"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Live updates for a server-rendered list. Subscribes to Postgres changes on
 * one or more tables and calls router.refresh() when anything changes, so the
 * server re-renders the view with fresh data — already RLS- and showcase-
 * filtered, since it's the same server render as the first paint. No row data
 * from the realtime stream ever reaches the client directly.
 *
 * This is the counterpart to the debug board's in-place setRows subscription:
 * use that when the list lives in client state and you want zero-latency patches;
 * use THIS when the list is server-rendered (most sections) and a refresh is the
 * simplest correct way to reflect someone else's change.
 *
 *   useRealtimeRefresh("contacts");
 *   useRealtimeRefresh(["marketing_posts", "marketing_campaigns"]);
 *
 * Refreshes are coalesced: a burst of changes (e.g. a batch insert) triggers a
 * single refresh on the next tick, not one per row.
 */
/** The shape every postgres_changes handler receives. */
export type ChangePayload = RealtimePostgresChangesPayload<
  Record<string, unknown>
>;

export function useRealtimeRefresh(
  tables: string | string[],
  /**
   * Decide per event whether a refresh is worth a server round trip. Omit and
   * every change refreshes. Used by the shell's chat subscription to ignore
   * events belonging to a thread that is already patching itself in place —
   * refreshing for those repainted the open thread for nothing.
   *
   * Must be referentially stable (useCallback) or the channel re-subscribes.
   */
  shouldRefresh?: (payload: ChangePayload) => boolean,
  /**
   * Side effect per event, for a caller that needs the ROW and not just the
   * repaint — the shell's chat alerts, which chime and post a desktop
   * notification. Runs for every event, BEFORE and independently of
   * `shouldRefresh`: the two answer different questions, and a message in the
   * open thread (no refresh) may still deserve an alert when the tab is hidden.
   *
   * Exists so that caller can ride this channel instead of joining a second one
   * to the same tables — see the note in (app)/messages/layout.tsx.
   */
  onChange?: (payload: ChangePayload) => void
) {
  const router = useRouter();
  // Stringify so the effect re-subscribes only when the actual table set
  // changes, not on every render (a fresh array literal each time otherwise).
  const key = Array.isArray(tables) ? tables.join(",") : tables;

  // Keep the newest router in a ref so the subscription callback always calls
  // the current one without being a dependency that re-subscribes. Synced in an
  // effect (not during render) — writing a ref while rendering is impure.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Same reasoning as the router ref: kept out of the effect's dependencies so a
  // changing predicate never tears down and re-authorizes the socket.
  const filterRef = useRef(shouldRefresh);
  useEffect(() => {
    filterRef.current = shouldRefresh;
  }, [shouldRefresh]);

  // Same again for the side effect: it closes over props that change on every
  // server refresh (the members map), and none of that may re-open the socket.
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    if (list.length === 0) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Coalesce a burst of events into one refresh on the next tick.
    const scheduleRefresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        routerRef.current.refresh();
      }, 150);
    };

    (async () => {
      // These tables have RLS, so postgres_changes only delivers events when the
      // realtime socket carries the user's JWT — otherwise it's authorized as
      // anon and streams nothing (the channel still reports SUBSCRIBED). Set the
      // token explicitly before subscribing. See the debug board for the same fix.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      let ch = supabase.channel(`realtime-refresh:${key}`);
      for (const table of list) {
        ch = ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload) => {
            changeRef.current?.(payload);
            const filter = filterRef.current;
            if (filter && !filter(payload)) return;
            scheduleRefresh();
          }
        );
      }
      ch.subscribe();
      channel = ch;
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [key]);
}
